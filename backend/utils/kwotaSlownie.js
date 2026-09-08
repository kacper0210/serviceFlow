/**
 * Przekształca kwotę numeryczną na słowny zapis w języku polskim.
 * Przykład: 162.00 -> "sto sześćdziesiąt dwa 00/100 PLN"
 */
function kwotaSlownie(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '';
  
  const num = Math.abs(parseFloat(amount));
  const zl = Math.floor(num);
  const gr = Math.round((num - zl) * 100);
  const grString = gr < 10 ? `0${gr}` : `${gr}`;

  if (zl === 0) {
    return `zero ${grString}/100 PLN`;
  }

  const jednosci = ['', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć'];
  const nastki = ['dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście', 'piętnaście', 'szesnaście', 'siedemnaście', 'osiemnaście', 'dziewiętnaście'];
  const dziesiatki = ['', 'dziesięć', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt', 'sześćdziesiąt', 'siedemdziesiąt', 'osiemdziesiąt', 'dziewięćdziesiąt'];
  const setki = ['', 'sto', 'dwieście', 'trzysta', 'czterysta', 'pięćset', 'sześćset', 'siedemset', 'osiemset', 'dziewięćset'];

  function trojkaDoSlów(n) {
    let s = Math.floor(n / 100);
    let d = Math.floor((n % 100) / 10);
    let j = n % 10;
    let res = [];

    if (s > 0) res.push(setki[s]);

    if (d === 1) {
      res.push(nastki[j]);
    } else {
      if (d > 1) res.push(dziesiatki[d]);
      if (j > 0) res.push(jednosci[j]);
    }
    return res.join(' ');
  }

  function odmianaTysiace(n) {
    let d = Math.floor((n % 100) / 10);
    let j = n % 10;
    if (n === 1) return 'tysiąc';
    if (d !== 1 && (j === 2 || j === 3 || j === 4)) return 'tysiące';
    return 'tysięcy';
  }

  let wynik = [];
  
  let miliony = Math.floor(zl / 1000000);
  let tysiace = Math.floor((zl % 1000000) / 1000);
  let reszta = zl % 1000;

  if (miliony > 0) {
    wynik.push(trojkaDoSlów(miliony) + ' mln');
  }

  if (tysiace > 0) {
    wynik.push(trojkaDoSlów(tysiace) + ' ' + odmianaTysiace(tysiace));
  }

  if (reszta > 0) {
    wynik.push(trojkaDoSlów(reszta));
  }

  return `${wynik.join(' ')} ${grString}/100 PLN`;
}

module.exports = kwotaSlownie;
