const crypto = require('crypto');
require('dotenv').config();

// Fallback to secure default hex key if process.env.KSEF_ENCRYPTION_KEY is not defined in host environment
const KSEF_ENCRYPTION_KEY = process.env.KSEF_ENCRYPTION_KEY || '9a3b8c6e2d1f4a5b0e2f3d4c5a6b7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4';

// In-memory session cache for KSeF 2.0 tokens (fast lookup fallback)
const sessionCache = new Map();

/**
 * Encrypts a token using AES-256-GCM.
 */
function encryptToken(token) {
  if (!token) return { encryptedToken: null, iv: null, tag: null };
  const hashedKey = crypto.createHash('sha256').update(KSEF_ENCRYPTION_KEY).digest();
  const iv = crypto.randomBytes(12); // Standard GCM IV length (12 bytes)
  const cipher = crypto.createCipheriv('aes-256-gcm', hashedKey, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag().toString('hex');
  
  return {
    encryptedToken: encrypted,
    iv: iv.toString('hex'),
    tag: tag
  };
}

/**
 * Decrypts a token using AES-256-GCM.
 */
function decryptToken(encryptedToken, ivHex, tagHex) {
  if (!encryptedToken || !ivHex || !tagHex) return null;
  try {
    const hashedKey = crypto.createHash('sha256').update(KSEF_ENCRYPTION_KEY).digest();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', hashedKey, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedToken, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (e) {
    console.error("Decryption failed:", e.message);
    return null;
  }
}

/**
 * Wrapper around fetch with exponential backoff retry for HTTP 429 Rate Limits.
 */
async function fetchWithRetry(url, options = {}, maxRetries = 2) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    const res = await fetch(url, options);
    if (res.status === 429) {
      attempt++;
      const retryAfterHeader = res.headers.get('retry-after');
      const waitSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 0;
      
      // If KSeF requires waiting more than 8 seconds, fail fast with informative message instead of hanging the connection
      if (waitSeconds > 8) {
        const waitMinutes = Math.ceil(waitSeconds / 60);
        throw new Error(`Przekroczono limit zapytań KSeF (błąd HTTP 429 Rate Limit). KSeF wymaga odczekania ok. ${waitMinutes} min przed kolejną synchronizacją.`);
      }

      if (attempt > maxRetries) {
        const errText = await res.text();
        throw new Error(`Przekroczono limit zapytań KSeF (Rate Limit 429 Exceeded): ${errText}`);
      }
      
      const waitMs = waitSeconds > 0 ? Math.min(waitSeconds * 1000, 5000) : 2000 * Math.pow(2, attempt);
      console.warn(`[KSeF Rate Limit 429] Waiting ${waitMs}ms before retry attempt ${attempt}/${maxRetries}...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      continue;
    }
    return res;
  }
}

/**
 * Returns KSeF API URL based on environment setting.
 */
function getApiUrl(env) {
  if (env === 'production') {
    return 'https://api.ksef.mf.gov.pl/v2';
  }
  return 'https://api-test.ksef.mf.gov.pl/v2';
}

/**
 * Clears stored session tokens from DB and memory (used when token is revoked/invalid).
 */
async function clearSessionInDb(pool, nip) {
  if (!nip) return;
  sessionCache.delete(nip);
  if (!pool) return;
  try {
    await pool.query(`
      UPDATE ksef_settings 
      SET 
        encrypted_access_token = NULL,
        access_token_iv = NULL,
        access_token_tag = NULL,
        encrypted_refresh_token = NULL,
        refresh_token_iv = NULL,
        refresh_token_tag = NULL,
        access_token_expires_at = NULL
      WHERE nip = $1
    `, [nip]);
    console.log(`[KSeF Session] Cleared stale session in DB for NIP ${nip}`);
  } catch (err) {
    console.error("Failed to clear KSeF session in DB:", err.message);
  }
}

/**
 * Saves active session tokens to database for cross-request & cloud persistence.
 */
async function saveSessionToDb(pool, nip, session) {
  if (!pool || !nip || !session) return;
  try {
    const encAccess = encryptToken(session.accessToken);
    const encRefresh = session.refreshToken ? encryptToken(session.refreshToken) : { encryptedToken: null, iv: null, tag: null };
    
    const cleanNip = nip.replace(/\D/g, '');
    await pool.query(`
      UPDATE ksef_settings 
      SET 
        encrypted_access_token = $1,
        access_token_iv = $2,
        access_token_tag = $3,
        encrypted_refresh_token = $4,
        refresh_token_iv = $5,
        refresh_token_tag = $6,
        access_token_expires_at = $7,
        updated_at = NOW()
      WHERE REPLACE(nip, '-', '') = $8 OR id = (SELECT id FROM ksef_settings LIMIT 1)
    `, [
      encAccess.encryptedToken,
      encAccess.iv,
      encAccess.tag,
      encRefresh.encryptedToken,
      encRefresh.iv,
      encRefresh.tag,
      session.expiresAt,
      cleanNip
    ]);
    console.log(`[KSeF Session] Persisted session token to DB for NIP ${nip}`);
  } catch (err) {
    console.error("Failed to save KSeF session to DB:", err.message);
  }
}

/**
 * Loads session from DB if available and not expired.
 */
async function loadSessionFromDb(pool, nip, env, returnExpired = false) {
  if (!pool || !nip) return null;
  try {
    const cleanNip = nip.replace(/\D/g, '');
    const res = await pool.query(
      `SELECT encrypted_access_token, access_token_iv, access_token_tag,
              encrypted_refresh_token, refresh_token_iv, refresh_token_tag,
              access_token_expires_at
       FROM ksef_settings 
       WHERE (REPLACE(nip, '-', '') = $1 OR id = (SELECT id FROM ksef_settings LIMIT 1))
         AND (environment = $2 OR environment IS NULL)`,
      [cleanNip, env]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    if (!row.encrypted_access_token || !row.access_token_expires_at) return null;

    const expiresAt = parseInt(row.access_token_expires_at, 10);
    const isExpired = Date.now() + 60000 >= expiresAt;

    const accessToken = decryptToken(row.encrypted_access_token, row.access_token_iv, row.access_token_tag);
    const refreshToken = row.encrypted_refresh_token ? decryptToken(row.encrypted_refresh_token, row.refresh_token_iv, row.refresh_token_tag) : null;

    if (!accessToken) return null;

    if (isExpired) {
      console.log("[KSeF Session] DB access token is expired or about to expire.");
      if (!returnExpired) return null;
      return { accessToken, refreshToken, expiresAt, nip, env, isExpired: true };
    }

    console.log(`[KSeF Session] Loaded valid session from DB for NIP ${nip} (expires in ${Math.round((expiresAt - Date.now()) / 1000)}s)`);
    return { accessToken, refreshToken, expiresAt, nip, env, isExpired: false };
  } catch (err) {
    console.error("Error loading session from DB:", err.message);
    return null;
  }
}

/**
 * Gets an active KSeF session (from Memory Cache, DB, Refresh, or Fresh Handshake).
 */
async function getActiveSession(nip, decryptedToken, env, pool = null) {
  // 1. Check Memory Cache
  const cached = sessionCache.get(nip);
  if (cached && cached.env === env) {
    if (Date.now() < cached.expiresAt) {
      return cached;
    }
    if (cached.refreshToken) {
      try {
        return await refreshKSeFToken(cached, pool);
      } catch (e) {
        console.warn("Memory token refresh failed:", e.message);
      }
    }
  }

  // 2. Check Database Cache
  if (pool) {
    const dbSession = await loadSessionFromDb(pool, nip, env, true);
    if (dbSession) {
      if (!dbSession.isExpired) {
        sessionCache.set(nip, dbSession);
        return dbSession;
      }
      if (dbSession.refreshToken) {
        try {
          console.log("[KSeF Session] Access token expired. Attempting refresh via refresh token...");
          const refreshed = await refreshKSeFToken(dbSession, pool);
          return refreshed;
        } catch (e) {
          console.warn("[KSeF Session] DB token refresh failed:", e.message);
        }
      }
    }
  }

  // 3. Fallback to Fresh Authentication
  return await authenticateKSeF(nip, decryptedToken, env, pool);
}

/**
 * Authenticates with KSeF 2.0 using NIP and auth token (5-step handshake).
 */
async function authenticateKSeF(nip, token, env, pool = null) {
  const apiUrl = getApiUrl(env);
  
  // Step 1: Challenge
  const challengeRes = await fetchWithRetry(`${apiUrl}/auth/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contextIdentifier: {
        type: 'Nip',
        value: nip
      }
    })
  });
  
  if (!challengeRes.ok) {
    const errText = await challengeRes.text();
    throw new Error(`KSeF Challenge failed (${challengeRes.status}): ${errText}`);
  }
  
  const { challenge, timestamp } = await challengeRes.json();
  
  // Step 2: Get KSeF Public Key Certificates
  const certsRes = await fetchWithRetry(`${apiUrl}/security/public-key-certificates`);
  if (!certsRes.ok) {
    throw new Error(`Failed to fetch KSeF public certificates (${certsRes.status})`);
  }
  
  const certsData = await certsRes.json();
  let certBase64 = null;
  if (Array.isArray(certsData)) {
    certBase64 = certsData[0]?.certificate;
  } else if (certsData && certsData.publicKeyCertificatesList) {
    certBase64 = certsData.publicKeyCertificatesList[0]?.certificate;
  }
  
  if (!certBase64) {
    throw new Error("No public key certificate returned by KSeF");
  }
  
  const pemPublicKey = `-----BEGIN CERTIFICATE-----\n${certBase64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;
  
  // Step 3: Encrypt AuthToken with RSA-OAEP SHA-256
  const timestampMs = new Date(timestamp).getTime();
  const payloadToEncrypt = `${token}|${timestampMs}`;
  
  const encryptedBuffer = crypto.publicEncrypt({
    key: pemPublicKey,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
  }, Buffer.from(payloadToEncrypt, 'utf8'));
  
  const encryptedTokenBase64 = encryptedBuffer.toString('base64');
  
  // Step 4: Call auth/ksef-token
  const authInitRes = await fetchWithRetry(`${apiUrl}/auth/ksef-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contextIdentifier: {
        type: 'Nip',
        value: nip
      },
      encryptedToken: encryptedTokenBase64,
      challenge: challenge
    })
  });
  
  if (!authInitRes.ok) {
    const errText = await authInitRes.text();
    throw new Error(`KSeF auth request init failed (${authInitRes.status}): ${errText}`);
  }
  
  const resData = await authInitRes.json();
  const referenceNumber = resData.referenceNumber;
  const authTokenValue = resData.authenticationToken?.token;
  if (!authTokenValue) {
    throw new Error("KSeF auth response did not contain authenticationToken.token");
  }

  // Step 5: Redeem authentication token to get session access token
  let attempts = 0;
  let sessionData = null;
  while (attempts < 10) {
    await new Promise(r => setTimeout(r, 2000));
    console.log(`[KSeF Polling] Redeeming auth token attempt ${attempts + 1} for ref ${referenceNumber}...`);
    
    const redeemRes = await fetchWithRetry(`${apiUrl}/auth/token/redeem`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authTokenValue}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (redeemRes.ok) {
      sessionData = await redeemRes.json();
      break;
    }

    const errText = await redeemRes.text();
    let errJson = null;
    try { errJson = JSON.parse(errText); } catch (e) {}

    const excDetail = errJson?.exception?.exceptionDetailList?.[0];
    if (excDetail) {
      const desc = excDetail.exceptionDescription || 'Błąd autoryzacji';
      const detailsStr = excDetail.details ? ` (${excDetail.details.join(', ')})` : '';
      throw new Error(`${desc}${detailsStr}`);
    }

    attempts++;
  }

  if (!sessionData) {
    throw new Error("Nie udało się pobrać tokena sesyjnego KSeF (timeout).");
  }

  const accessTokenVal = typeof sessionData.accessToken === 'object' ? sessionData.accessToken?.token : sessionData.accessToken || authTokenValue;
  const refreshTokenVal = typeof sessionData.refreshToken === 'object' ? sessionData.refreshToken?.token : sessionData.refreshToken || null;
  
  const expiresAt = Date.now() + 14 * 60 * 1000;
  const session = { accessToken: accessTokenVal, refreshToken: refreshTokenVal, expiresAt, nip, env };
  
  sessionCache.set(nip, session);
  if (pool) {
    await saveSessionToDb(pool, nip, session);
  }
  
  return session;
}

/**
 * Refreshes an expired KSeF access token using the refresh token.
 */
async function refreshKSeFToken(session, pool = null) {
  const apiUrl = getApiUrl(session.env);
  
  const refreshRes = await fetchWithRetry(`${apiUrl}/auth/token/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.refreshToken}`
    }
  });
  
  if (!refreshRes.ok) {
    throw new Error(`Failed to refresh KSeF session (${refreshRes.status}). Re-authenticating.`);
  }
  
  const refreshData = await refreshRes.json();
  const nextAccessToken = typeof refreshData.accessToken === 'object' ? refreshData.accessToken?.token : refreshData.accessToken;
  const nextRefreshToken = typeof refreshData.refreshToken === 'object' ? refreshData.refreshToken?.token : refreshData.refreshToken;
  
  if (!nextAccessToken) {
    throw new Error("KSeF refresh response did not contain accessToken");
  }
  
  session.accessToken = nextAccessToken;
  session.refreshToken = nextRefreshToken || session.refreshToken;
  session.expiresAt = Date.now() + 14 * 60 * 1000;
  
  sessionCache.set(session.nip, session);
  if (pool) {
    await saveSessionToDb(pool, session.nip, session);
  }
  return session;
}

/**
 * Gets an active KSeF session (from Memory Cache, DB, Refresh, or Fresh Handshake).
 */
async function getActiveSession(nip, decryptedToken, env, pool = null) {
  // 1. Check Memory Cache
  const cached = sessionCache.get(nip);
  if (cached && cached.env === env) {
    if (Date.now() < cached.expiresAt) {
      return cached;
    }
    try {
      return await refreshKSeFToken(cached, pool);
    } catch (e) {
      console.warn("Memory refresh failed, trying DB", e.message);
    }
  }

  // 2. Check Database Cache
  if (pool) {
    const dbSession = await loadSessionFromDb(pool, nip, env);
    if (dbSession) {
      sessionCache.set(nip, dbSession);
      return dbSession;
    }
  }

  // 3. Fallback to Fresh Authentication
  return await authenticateKSeF(nip, decryptedToken, env, pool);
}

/**
 * Auto-categorizes contractor name/NIP into expenses category & car cost flag.
 */
function determineCategory(contractorName = '', contractorNip = '') {
  const name = contractorName.toUpperCase();
  
  // Fuel / Vehicle Costs
  if (
    name.includes('ORLEN') || name.includes('LOTOS') || name.includes('BP ') ||
    name.includes('SHELL') || name.includes('CIRCLE K') || name.includes('AMIC') ||
    name.includes('MOL ') || name.includes('STACJA PALIW') || name.includes('AUTO') ||
    name.includes('MECHANIK') || name.includes('SERWIS SAMOCHODOWY')
  ) {
    return { category: 'Auto', is_car_cost: true };
  }
  
  // Utilities / Media
  if (
    name.includes('PGE') || name.includes('TAURON') || name.includes('ENEA') ||
    name.includes('ENERGA') || name.includes('E.ON') || name.includes('INNOGY') ||
    name.includes('PGNIG') || name.includes('GAZ') || name.includes('WODOCIĄGI')
  ) {
    return { category: 'Media', is_car_cost: false };
  }

  // Telecom / Internet
  if (
    name.includes('PLAY') || name.includes('P4') || name.includes('ORANGE') ||
    name.includes('T-MOBILE') || name.includes('PLUS') || name.includes('POLKOMTEL') ||
    name.includes('UPC') || name.includes('VECTRA') || name.includes('NETIA')
  ) {
    return { category: 'Telefon/Internet', is_car_cost: false };
  }

  // IT & Software
  if (
    name.includes('GOOGLE') || name.includes('MICROSOFT') || name.includes('GITHUB') ||
    name.includes('AWS') || name.includes('AMAZON WEB') || name.includes('ADOBE') ||
    name.includes('JETBRAINS') || name.includes('OVH') || name.includes('HETZNER')
  ) {
    return { category: 'Oprogramowanie/IT', is_car_cost: false };
  }

  // Materials / Office Equipment
  if (
    name.includes('ALLEGRO') || name.includes('CASTORAMA') || name.includes('LEROY') ||
    name.includes('IKEA') || name.includes('MEDIA MARKT') || name.includes('X-KOM') ||
    name.includes('BIURO') || name.includes('PAPER')
  ) {
    return { category: 'Materiały i Wyposażenie', is_car_cost: false };
  }

  return { category: 'Inne', is_car_cost: false };
}

/**
 * Synchronizes & Caches KSeF invoices into local Database (`ksef_invoices`).
 */
async function syncInvoicesToDb(pool, nip, decryptedToken, env, year, month) {
  let invoicesToCache = [];

  if (env === 'mock') {
    invoicesToCache = generateMockInvoices(year, month);
  } else {
    const session = await getActiveSession(nip, decryptedToken, env, pool);
    const apiUrl = getApiUrl(env);
    
    const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const dateTo = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    const queryUrl = `${apiUrl}/invoices/query/metadata`;
    let pageOffset = 0;
    const pageSize = 100;
    let allInvoices = [];
    let hasMore = true;

    for (const subjectType of ["Subject1", "Subject2"]) {
      const isSales = subjectType === "Subject1";
      let pageOffset = 0;
      let hasMore = true;

      while (hasMore) {
        const queryBody = {
          subjectType: subjectType,
          dateRange: {
            from: `${dateFrom}T00:00:00Z`,
            to: `${dateTo}T23:59:59Z`,
            dateType: "Issue"
          },
          PageOffset: pageOffset,
          PageSize: pageSize
        };

        const queryOptions = {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(queryBody)
        };

        let queryRes = await fetchWithRetry(queryUrl, queryOptions);
        if (queryRes.status === 401) {
          console.warn("[KSeF Auth 401] Access token rejected. Invalidating DB session and re-authenticating...");
          await clearSessionInDb(pool, nip);
          const freshSession = await authenticateKSeF(nip, decryptedToken, env, pool);
          queryOptions.headers['Authorization'] = `Bearer ${freshSession.accessToken}`;
          queryRes = await fetchWithRetry(queryUrl, queryOptions);
        }

        if (queryRes.ok) {
          const data = await queryRes.json();
          const list = data.invoices || data.invoiceMetadataList || data.invoiceHeaderList || [];
          
          for (const inv of list) {
            const refNum = inv.ksefNumber || inv.ksefInvoiceReferenceNumber || inv.ksefReferenceNumber || inv.invoiceKsefNumber;
            const invNum = inv.invoiceNumber || inv.invoiceReferenceNumber || (refNum ? 'FV/' + refNum.substring(0, 10) : 'KSEF');
            
            let contractorNip = '0000000000';
            let contractorName = 'Kontrahent KSeF';

            if (isSales) {
              if (inv.buyer) {
                contractorNip = inv.buyer.nip || '0000000000';
                contractorName = inv.buyer.name || 'Nabywca KSeF';
              } else if (inv.subject2) {
                contractorNip = inv.subject2.identifier?.identifier || inv.subject2.nip || '0000000000';
                contractorName = inv.subject2.name || inv.subject2.fullName || 'Nabywca KSeF';
              }
            } else {
              if (inv.seller) {
                contractorNip = inv.seller.nip || '0000000000';
                contractorName = inv.seller.name || 'Sprzedawca KSeF';
              } else if (inv.subject1) {
                contractorNip = inv.subject1.identifier?.identifier || inv.subject1.nip || '0000000000';
                contractorName = inv.subject1.name || inv.subject1.fullName || 'Sprzedawca KSeF';
              }
            }

            let date = dateFrom;
            if (inv.issueDate) date = inv.issueDate.split('T')[0];
            else if (inv.invoicingDate) date = inv.invoicingDate.split('T')[0];

            allInvoices.push({
              ksef_reference_number: refNum,
              invoice_number: invNum,
              contractor_name: contractorName,
              contractor_nip: contractorNip,
              date: date,
              net_amount: parseFloat(inv.netAmount) || 0,
              vat_amount: parseFloat(inv.vatAmount) || 0,
              gross_amount: parseFloat(inv.grossAmount) || 0,
              vat_rate: 23,
              is_sales: isSales,
              subject_type: subjectType
            });
          }
          hasMore = data.hasMore === true;
        } else {
          hasMore = false;
        }
      }
    }

    invoicesToCache = allInvoices;
  }

  // UPSERT into DB table ksef_invoices
  for (const inv of invoicesToCache) {
    const { category, is_car_cost } = inv.is_sales 
      ? { category: "Sprzedaż usług/towarów", is_car_cost: false } 
      : determineCategory(inv.contractor_name, inv.contractor_nip);
    
    await pool.query(`
      INSERT INTO ksef_invoices (
        ksef_reference_number, invoice_number, contractor_name, contractor_nip,
        date, net_amount, vat_rate, vat_amount, gross_amount,
        is_car_cost, suggested_category, is_sales, subject_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (ksef_reference_number) DO UPDATE SET
        invoice_number = EXCLUDED.invoice_number,
        contractor_name = EXCLUDED.contractor_name,
        contractor_nip = EXCLUDED.contractor_nip,
        date = EXCLUDED.date,
        net_amount = EXCLUDED.net_amount,
        vat_amount = EXCLUDED.vat_amount,
        gross_amount = EXCLUDED.gross_amount,
        suggested_category = EXCLUDED.suggested_category,
        is_car_cost = EXCLUDED.is_car_cost,
        is_sales = EXCLUDED.is_sales,
        subject_type = EXCLUDED.subject_type
    `, [
      inv.ksef_reference_number,
      inv.invoice_number,
      inv.contractor_name,
      inv.contractor_nip,
      inv.date,
      inv.net_amount,
      inv.vat_rate || 23,
      inv.vat_amount,
      inv.gross_amount,
      inv.is_car_cost || false,
      category,
      inv.is_sales || false,
      inv.subject_type || 'Subject2'
    ]);
  }

  // Update last_sync_at in ksef_settings
  await pool.query(`UPDATE ksef_settings SET last_sync_at = NOW() WHERE nip = $1`, [nip]);

  // Return cached invoices for requested month/year from DB
  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const dateTo = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const res = await pool.query(`
    SELECT * FROM ksef_invoices
    WHERE date >= $1 AND date <= $2
    ORDER BY date DESC
  `, [dateFrom, dateTo]);

  return res.rows;
}

/**
 * Generates realistic Mock KSeF cost invoices for development / testing.
 */
function generateMockInvoices(year, month) {
  const dateStr = (day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
  return [
    {
      ksef_reference_number: `1251347622-2026${String(month).padStart(2, '0')}${String(year).substring(2)}-83BAE932A-F1`,
      invoice_number: `FV/${year}/${month}/PGE/8492`,
      contractor_name: 'PGE Dystrybucja S.A.',
      contractor_nip: '8133558778',
      date: dateStr(4),
      net_amount: 320.00,
      vat_rate: 23,
      vat_amount: 73.60,
      gross_amount: 393.60,
      is_car_cost: false
    },
    {
      ksef_reference_number: `8361543789-2026${String(month).padStart(2, '0')}${String(year).substring(2)}-21CD4F82D-A4`,
      invoice_number: `P/18249/05/${year}`,
      contractor_name: 'ORLEN S.A.',
      contractor_nip: '7740001454',
      date: dateStr(12),
      net_amount: 243.90,
      vat_rate: 23,
      vat_amount: 56.10,
      gross_amount: 300.00,
      is_car_cost: true
    },
    {
      ksef_reference_number: `9472651438-2026${String(month).padStart(2, '0')}${String(year).substring(2)}-92AA73E1B-C2`,
      invoice_number: `INV-US-2026-${year}-${month}`,
      contractor_name: 'Google Cloud Poland Sp. z o.o.',
      contractor_nip: '5252809623',
      date: dateStr(18),
      net_amount: 150.00,
      vat_rate: 23,
      vat_amount: 34.50,
      gross_amount: 184.50,
      is_car_cost: false
    },
    {
      ksef_reference_number: `4829104756-2026${String(month).padStart(2, '0')}${String(year).substring(2)}-38DF67B2A-E8`,
      invoice_number: `F/Play/9824/${month}/${year}`,
      contractor_name: 'P4 Sp. z o.o. (Play)',
      contractor_nip: '9512120077',
      date: dateStr(22),
      net_amount: 89.00,
      vat_rate: 23,
      vat_amount: 20.47,
      gross_amount: 109.47,
      is_car_cost: false
    },
    {
      ksef_reference_number: `6371849204-2026${String(month).padStart(2, '0')}${String(year).substring(2)}-47AB39C5E-F7`,
      invoice_number: `ALL/284920/26/${month}`,
      contractor_name: 'Allegro Sp. z o.o.',
      contractor_nip: '5252674798',
      date: dateStr(26),
      net_amount: 115.50,
      vat_rate: 23,
      vat_amount: 26.57,
      gross_amount: 142.07,
      is_car_cost: false
    }
  ];
}

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateKsefFa3Xml(data) {
  const {
    sellerNip,
    sellerName,
    buyerNip,
    buyerName,
    invoiceNumber,
    issueDate,
    saleDate,
    items,
    totalNet,
    totalVat,
    totalGross
  } = data;

  const nowIso = new Date().toISOString();

  let itemsXml = '';
  items.forEach((it, idx) => {
    const net = (it.quantity * it.unit_price).toFixed(2);
    itemsXml += `
    <FaWiersz>
      <NrWierszaFa>${idx + 1}</NrWierszaFa>
      <P_7>${escapeXml(it.description)}</P_7>
      <P_8A>${it.quantity}</P_8A>
      <P_8B>szt</P_8B>
      <P_9A>${it.unit_price.toFixed(2)}</P_9A>
      <P_11>${net}</P_11>
      <P_12>${it.vat_rate || 23}</P_12>
    </FaWiersz>`;
  });

  const cleanBuyerNip = buyerNip ? buyerNip.replace(/\D/g, '') : '';
  const buyerIdXml = cleanBuyerNip.length === 10
    ? `<NIP>${cleanBuyerNip}</NIP>`
    : `<BrakID>1</BrakID>`;

  return `<?xml version="1.0" encoding="utf-8"?>
<Faktura xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaFa>${nowIso}</DataWytworzeniaFa>
    <SystemInfo>ServiceFlow KSeF Integrator FA(3)</SystemInfo>
  </Naglowek>
  <Podmiot1>
    <DaneIdentyfikacyjne>
      <NIP>${sellerNip || '6722109643'}</NIP>
      <Nazwa>${escapeXml(sellerName || 'Przedsiębiorstwo')}</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>PL</KodKraju>
      <AdresL1>Polska</AdresL1>
    </Adres>
  </Podmiot1>
  <Podmiot2>
    <DaneIdentyfikacyjne>
      ${buyerIdXml}
      <Nazwa>${escapeXml(buyerName)}</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>PL</KodKraju>
      <AdresL1>Polska</AdresL1>
    </Adres>
    <JST>2</JST>
    <GV>2</GV>
  </Podmiot2>
  <Fa>
    <KodWaluty>PLN</KodWaluty>
    <P_1>${issueDate}</P_1>
    <P_2>${escapeXml(invoiceNumber)}</P_2>
    <P_6>${saleDate || issueDate}</P_6>
    <P_13_1>${totalNet.toFixed(2)}</P_13_1>
    <P_14_1>${totalVat.toFixed(2)}</P_14_1>
    <P_15>${totalGross.toFixed(2)}</P_15>
    <Adnotacje>
      <P_16>2</P_16>
      <P_17>2</P_17>
      <P_18>2</P_18>
      <P_18A>2</P_18A>
      <Zwolnienie>
        <P_19N>1</P_19N>
      </Zwolnienie>
      <NoweSrodkiTransportu>
        <P_22N>1</P_22N>
      </NoweSrodkiTransportu>
      <P_23>2</P_23>
      <PMarzy>
        <P_PMarzyN>1</P_PMarzyN>
      </PMarzy>
    </Adnotacje>
    <RodzajFaktury>VAT</RodzajFaktury>
    ${itemsXml}
    <Platnosc>
      <FormaPlatnosci>1</FormaPlatnosci>
    </Platnosc>
  </Fa>
</Faktura>`.trim();
}

module.exports = {
  encryptToken,
  decryptToken,
  clearSessionInDb,
  getActiveSession,
  syncInvoicesToDb,
  determineCategory,
  generateMockInvoices,
  generateKsefFa3Xml
};
