const pool = require('./db');
const ksefService = require('./ksefService');

async function seedDemoData() {
  try {
    console.log('Seeding demo data into zlecenia_db database...');

    // 1. Seed Clients
    const clientsData = [
      { type: 'company', company_name: 'Bud-Mex Sp. z o.o.', nip: '5252809611', email: 'kontakt@budmex.pl', phone: '+48 22 555 12 34', address: 'ul. Przemysłowa 12, 00-450 Warszawa' },
      { type: 'company', company_name: 'Auto-Serwis Kowalski S.C.', nip: '7740001488', email: 'biuro@autoserwis-kowalski.pl', phone: '+48 24 262 40 10', address: 'ul. Główna 45, 09-400 Płock' },
      { type: 'company', company_name: 'SoftTech Solutions Sp. z o.o.', nip: '9512120099', email: 'biuro@softtech.pl', phone: '+48 61 888 33 22', address: 'ul. Marcelińska 90, 60-324 Poznań' },
      { type: 'company', company_name: 'Drukarnia Nowoczesna Tomasz Nowak', nip: '6722109655', email: 'zamowienia@drukarnia-nowak.pl', phone: '+48 12 420 15 00', address: 'ul. Wielicka 25, 30-552 Kraków' },
      { type: 'company', company_name: 'Akademia Finansów Sp. z o.o.', nip: '8133558711', email: 'biuro@akademiafinansow.pl', phone: '+48 17 850 99 00', address: 'ul. Jagiellońska 8, 35-010 Rzeszów' },
      { type: 'person', first_name: 'Piotr', last_name: 'Zieliński', email: 'p.zielinski@gmail.com', phone: '+48 601 234 567', address: 'ul. Słoneczna 15/4, 02-790 Warszawa' },
      { type: 'company', company_name: 'Magdalena Wiśniewska Studio Projektowe', nip: '5213894012', email: 'm.wisniewska@studioprojekt.pl', phone: '+48 71 340 50 60', address: 'ul. Świdnicka 18, 50-068 Wrocław' },
      { type: 'company', company_name: 'Logistics & Distribution Sp. z o.o.', nip: '5262747990', email: 'office@logistics-dist.pl', phone: '+48 58 300 40 50', address: 'ul. Portowa 5, 80-888 Gdańsk' }
    ];

    const clientIds = [];
    for (const c of clientsData) {
      const res = await pool.query(
        `INSERT INTO clients (type, first_name, last_name, company_name, nip, email, phone, address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [c.type, c.first_name || null, c.last_name || null, c.company_name || null, c.nip || null, c.email, c.phone, c.address]
      );
      clientIds.push(res.rows[0].id);
    }
    console.log(`✓ Seeded ${clientIds.length} clients.`);

    // 2. Seed Orders
    const ordersData = [
      {
        title: 'Wdrożenie i konfiguracja serwera firmy Bud-Mex',
        description: 'Instalacja systemu Windows Server 2025, migracja kont Active Directory, konfiguracja kopii zapasowych w chmurze.',
        status: 'completed',
        price: 8500.00,
        vat_rate: 23,
        client_id: clientIds[0],
        deadline: '2026-08-15'
      },
      {
        title: 'Montaż nowej instalacji elektrycznej w biurze Poznań',
        description: 'Wymiana rozdzielnicy, okablowanie 24 stanowisk komputerowych, montaż oświetlenia LED.',
        status: 'in_progress',
        price: 14200.00,
        vat_rate: 23,
        client_id: clientIds[2],
        deadline: '2026-08-30'
      },
      {
        title: 'Przegląd techniczny i serwis 5 pojazdów dostawczych',
        description: 'Wymiana oleju, filtrów, klocków hamulcowych oraz przegląd klimatyzacji.',
        status: 'new',
        price: 3800.00,
        vat_rate: 23,
        client_id: clientIds[1],
        deadline: '2026-09-05'
      },
      {
        title: 'Projekt graficzny identyfikacji wizualnej marki',
        description: 'Księga znaku, nowe logo, projekty wizytówek, papieru firmowego oraz szablonów social media.',
        status: 'in_progress',
        price: 6500.00,
        vat_rate: 23,
        client_id: clientIds[6],
        deadline: '2026-09-10'
      },
      {
        title: 'Serwis okresowy i konserwacja maszyny drukarskiej A4',
        description: 'Czyszczenie głowic, kalibracja taśmociągu, wymiana rolek podających.',
        status: 'completed',
        price: 2400.00,
        vat_rate: 23,
        client_id: clientIds[3],
        deadline: '2026-08-10'
      },
      {
        title: 'Audyt bezpieczeństwa sieci LAN oraz testy penetracyjne',
        description: 'Przegląd reguł firewall, weryfikacja uprawnień użytkowników, raport z zaleceniami bezpieczeństwa.',
        status: 'on_hold',
        price: 5000.00,
        vat_rate: 23,
        client_id: clientIds[4],
        deadline: '2026-09-15'
      },
      {
        title: 'Instalacja klimatyzacji przemysłowej w magazynie głównym',
        description: 'Dostawa i montaż 4 jednostek zewnętrznych oraz przewodów wentylacyjnych w hali 800m2.',
        status: 'in_progress',
        price: 22000.00,
        vat_rate: 23,
        client_id: clientIds[7],
        deadline: '2026-09-20'
      },
      {
        title: 'Naprawa instalacji hydraulicznej w mieszkaniu prywatnym',
        description: 'Wymiana zaworów głównych oraz naprawa odpływu w łazience.',
        status: 'completed',
        price: 1200.00,
        vat_rate: 23,
        client_id: clientIds[5],
        deadline: '2026-08-05'
      }
    ];

    const orderIds = [];
    for (const o of ordersData) {
      const res = await pool.query(
        `INSERT INTO orders (title, description, status, price, vat_rate, client_id, deadline)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [o.title, o.description, o.status, o.price, o.vat_rate, o.client_id, o.deadline]
      );
      orderIds.push(res.rows[0].id);
    }
    console.log(`✓ Seeded ${orderIds.length} orders.`);

    // 3. Seed Order Costs
    const costsData = [
      { order_id: orderIds[0], title: 'Zakup licencji Windows Server 2025 Standard', amount: 3200.00 },
      { order_id: orderIds[0], title: 'Dyski SSD Kioxia NVMe 2TB (2 szt.)', amount: 1100.00 },
      { order_id: orderIds[1], title: 'Kable UTP Cat6a 300m + Gniazda RJ45 Legrand', amount: 2400.00 },
      { order_id: orderIds[1], title: 'Rozdzielnica Eaton + Wyłączniki RCD', amount: 1800.00 },
      { order_id: orderIds[6], title: 'Jednostki klimatyzacyjne Rotenso 12kW (4 szt.)', amount: 11500.00 }
    ];

    for (const c of costsData) {
      await pool.query(
        `INSERT INTO order_costs (order_id, title, amount) VALUES ($1, $2, $3)`,
        [c.order_id, c.title, c.amount]
      );
    }
    console.log(`✓ Seeded ${costsData.length} order costs.`);

    // 4. Seed Offers & Offer Items
    const offerRes = await pool.query(
      `INSERT INTO offers (title, description, client_id, status, total_net, total_vat, total_gross, valid_until, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        'Oferta na modernizację infrastruktury IT i sieci WiFi 6',
        'Kompleksowa dostawa punktów dostępowych Ubiquiti UniFi, przełączników PoE oraz konfiguracja sieci wdrożeniowej.',
        clientIds[2],
        'sent',
        16500.00,
        3795.00,
        20295.00,
        '2026-09-30',
        'Ceny zawierają montaż, konfigurację i 24-miesięczną gwarancję door-to-door.'
      ]
    );
    const offerId = offerRes.rows[0].id;

    const offerItems = [
      { offer_id: offerId, title: 'Punkt Dostępowy Ubiquiti U6 Pro (WiFi 6)', quantity: 6, unit: 'szt.', unit_price_net: 750.00, net_amount: 4500.00, vat_rate: 23, vat_amount: 1035.00, gross_amount: 5535.00 },
      { offer_id: offerId, title: 'Przełącznik Ubiquiti USW-24-PoE (24 porty Gigabit)', quantity: 2, unit: 'szt.', unit_price_net: 2400.00, net_amount: 4800.00, vat_rate: 23, vat_amount: 1104.00, gross_amount: 5904.00 },
      { offer_id: offerId, title: 'Brama Sieciowa UniFi UDM Pro', quantity: 1, unit: 'szt.', unit_price_net: 2200.00, net_amount: 2200.00, vat_rate: 23, vat_amount: 506.00, gross_amount: 2706.00 },
      { offer_id: offerId, title: 'Usługa montażu, okablowania i wdrożenia sieci', quantity: 1, unit: 'usł.', unit_price_net: 5000.00, net_amount: 5000.00, vat_rate: 23, vat_amount: 1150.00, gross_amount: 6150.00 }
    ];

    for (const item of offerItems) {
      await pool.query(
        `INSERT INTO offer_items (offer_id, title, quantity, unit, unit_price_net, net_amount, vat_rate, vat_amount, gross_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [item.offer_id, item.title, item.quantity, item.unit, item.unit_price_net, item.net_amount, item.vat_rate, item.vat_amount, item.gross_amount]
      );
    }
    console.log(`✓ Seeded 1 offer with ${offerItems.length} line items.`);

    // 5. Seed Accounting Entries (Przychody & Koszty)
    const entriesData = [
      // Przychody (Sales Invoices)
      { entry_type: 'revenue', date: '2026-08-15', number: 'FV/2026/08/001', contractor: 'Bud-Mex Sp. z o.o.', net_amount: 8500.00, vat_rate: 23, vat_amount: 1955.00, gross_amount: 10455.00, category: 'Usługi IT', is_car_cost: false, is_ready: true, description: 'Rozliczenie wdrożenia serwera' },
      { entry_type: 'revenue', date: '2026-08-10', number: 'FV/2026/08/002', contractor: 'Drukarnia Nowoczesna Tomasz Nowak', net_amount: 2400.00, vat_rate: 23, vat_amount: 552.00, gross_amount: 2952.00, category: 'Usługi Serwisowe', is_car_cost: false, is_ready: true, description: 'Serwis maszyny drukarskiej' },
      { entry_type: 'revenue', date: '2026-08-05', number: 'FV/2026/08/003', contractor: 'Piotr Zieliński', net_amount: 1200.00, vat_rate: 23, vat_amount: 276.00, gross_amount: 1476.00, category: 'Usługi Hydrauliczne', is_car_cost: false, is_ready: true, description: 'Naprawa instalacji' },
      { entry_type: 'revenue', date: '2026-07-28', number: 'FV/2026/07/045', contractor: 'SoftTech Solutions Sp. z o.o.', net_amount: 12500.00, vat_rate: 23, vat_amount: 2875.00, gross_amount: 15375.00, category: 'Usługi IT', is_car_cost: false, is_ready: true, description: 'Zaliczka na montaż instalacji' },

      // Koszty (Expenses)
      { entry_type: 'expense', date: '2026-08-26', number: 'ALL/284920/26/8', contractor: 'Allegro Sp. z o.o.', net_amount: 115.50, vat_rate: 23, vat_amount: 26.57, gross_amount: 142.07, category: 'Materiały i Wyposażenie', is_car_cost: false, is_ready: true, description: 'Zakup materiałów biurowych' },
      { entry_type: 'expense', date: '2026-08-22', number: 'F/Play/9824/8/2026', contractor: 'P4 Sp. z o.o. (Play)', net_amount: 89.00, vat_rate: 23, vat_amount: 20.47, gross_amount: 109.47, category: 'Telefon/Internet', is_car_cost: false, is_ready: true, description: 'Abonament firmowy' },
      { entry_type: 'expense', date: '2026-08-18', number: 'INV-US-2026-2026-8', contractor: 'Google Cloud Poland Sp. z o.o.', net_amount: 150.00, vat_rate: 23, vat_amount: 34.50, gross_amount: 184.50, category: 'Oprogramowanie/IT', is_car_cost: false, is_ready: true, description: 'Subskrypcja Google Workspace' },
      { entry_type: 'expense', date: '2026-08-12', number: 'P/18249/05/2026', contractor: 'ORLEN S.A.', net_amount: 243.90, vat_rate: 23, vat_amount: 56.10, gross_amount: 300.00, category: 'Auto', is_car_cost: true, is_ready: true, description: 'Paliwo do auta służbowego' },
      { entry_type: 'expense', date: '2026-08-04', number: 'FV/2026/8/PGE/8492', contractor: 'PGE Dystrybucja S.A.', net_amount: 320.00, vat_rate: 23, vat_amount: 73.60, gross_amount: 393.60, category: 'Media', is_car_cost: false, is_ready: true, description: 'Energia elektryczna biuro' }
    ];

    for (const entry of entriesData) {
      await pool.query(
        `INSERT INTO accounting_entries (
          entry_type, date, number, contractor, net_amount, vat_rate, vat_amount, gross_amount, category, is_car_cost, is_ready, description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          entry.entry_type, entry.date, entry.number, entry.contractor,
          entry.net_amount, entry.vat_rate, entry.vat_amount, entry.gross_amount,
          entry.category, entry.is_car_cost, entry.is_ready, entry.description
        ]
      );
    }
    console.log(`✓ Seeded ${entriesData.length} accounting entries.`);

    // 6. Sync Mock KSeF Invoices for 2026/08
    await ksefService.syncInvoicesToDb(pool, '6722109643', null, 'mock', 2026, 8);
    console.log(`✓ Seeded KSeF Mock invoices for August 2026.`);

    console.log('\n🌟 Baza danych została pomyślnie uzupełniona kompletem losowych, realistycznych danych!');
  } catch (err) {
    console.error('Błąd podczas uzupełniania bazy danych:', err);
  } finally {
    await pool.end();
  }
}

seedDemoData();
