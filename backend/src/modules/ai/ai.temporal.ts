export interface PeriodoEventos {
  desde: Date;
  hasta: Date;
  diaCompleto?: boolean;
  anioCompleto?: boolean;
  rangoDias?: boolean;
  soloVigentes?: boolean;
}

export interface FiltroTemporalEventos {
  periodo?: PeriodoEventos;
  soloFinalizados: boolean;
}

const ZONA_HORARIA = 'America/Bogota';
const MESES: readonly (readonly string[])[] = [
  ['enero', 'january', 'janvier'],
  ['febrero', 'february', 'fevrier'],
  ['marzo', 'march', 'mars'],
  ['abril', 'april', 'avril'],
  ['mayo', 'may', 'mai'],
  ['junio', 'june', 'juin'],
  ['julio', 'july', 'juillet'],
  ['agosto', 'august', 'aout'],
  ['septiembre', 'setiembre', 'september', 'septembre'],
  ['octubre', 'october', 'octobre'],
  ['noviembre', 'november', 'novembre'],
  ['diciembre', 'december', 'decembre'],
] as const;
const DIAS_SEMANA: readonly (readonly string[])[] = [
  ['domingo', 'sunday', 'dimanche'],
  ['lunes', 'monday', 'lundi'],
  ['martes', 'tuesday', 'mardi'],
  ['miercoles', 'wednesday', 'mercredi'],
  ['jueves', 'thursday', 'jeudi'],
  ['viernes', 'friday', 'vendredi'],
  ['sabado', 'saturday', 'samedi'],
] as const;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function distanciaDamerau(a: string, b: string): number {
  const matriz = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i += 1) matriz[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matriz[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      matriz[i][j] = Math.min(
        matriz[i - 1][j] + 1,
        matriz[i][j - 1] + 1,
        matriz[i - 1][j - 1] + costo,
      );
      if (
        i > 1 && j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        matriz[i][j] = Math.min(matriz[i][j], matriz[i - 2][j - 2] + 1);
      }
    }
  }
  return matriz[a.length][b.length];
}

function obtenerMes(token: string): number | undefined {
  const exacto = MESES.findIndex((sinonimos) => sinonimos.includes(token));
  if (exacto >= 0) return exacto;
  if (token.length < 6) return undefined;

  const distancias = MESES.map((sinonimos, indice) => ({
    indice,
    distancia: Math.min(...sinonimos.map((mes) => distanciaDamerau(token, mes))),
  })).sort((a, b) => a.distancia - b.distancia);
  const maximo = token.length >= 6 ? 2 : 1;
  if (
    distancias[0]?.distancia <= maximo &&
    distancias[0].distancia < distancias[1]?.distancia
  ) {
    return distancias[0].indice;
  }
  return undefined;
}

function obtenerDiaSemana(token: string): number | undefined {
  const exacto = DIAS_SEMANA.findIndex((sinonimos) => sinonimos.includes(token));
  if (exacto >= 0) return exacto;
  if (token.length < 5) return undefined;
  const distancias = DIAS_SEMANA.map((sinonimos, indice) => ({
    indice,
    distancia: Math.min(...sinonimos.map((dia) => distanciaDamerau(token, dia))),
  })).sort((a, b) => a.distancia - b.distancia);
  return distancias[0]?.distancia === 1 && distancias[0].distancia < distancias[1]?.distancia
    ? distancias[0].indice
    : undefined;
}

function fechaBogotaEnUTC(anio: number, mes: number, dia: number, hora = 0): Date {
  return new Date(Date.UTC(anio, mes, dia, 5 + hora));
}

function hoyEnBogota(ahora: Date): { anio: number; mes: number; dia: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);
  const valor = (tipo: string) => Number(partes.find((parte) => parte.type === tipo)?.value);
  return { anio: valor('year'), mes: valor('month') - 1, dia: valor('day') };
}

function anioDeConsulta(tokens: string[], indiceMes: number, actual: number): number {
  for (let i = Math.max(0, indiceMes - 3); i <= Math.min(tokens.length - 1, indiceMes + 3); i += 1) {
    if (/^(19|20)\d{2}$/.test(tokens[i])) return Number(tokens[i]);
  }
  return actual;
}

function obtenerDia(tokens: string[], indiceMes: number): number | undefined {
  const anterior = tokens[indiceMes - 1];
  const dosAntes = tokens[indiceMes - 2];
  const siguiente = tokens[indiceMes + 1];
  const numero = (valor: string | undefined) =>
    valor && /^\d{1,2}$/.test(valor) ? Number(valor) : undefined;
  const previo = numero(anterior);
  if (previo !== undefined) return previo;
  if (anterior === 'de') return numero(dosAntes);
  return numero(siguiente);
}

function construirPeriodo(anio: number, mes: number, dia?: number): PeriodoEventos | undefined {
  if (dia !== undefined) {
    const inicio = fechaBogotaEnUTC(anio, mes, dia);
    if (inicio.getUTCMonth() !== mes || inicio.getUTCDate() !== dia) return undefined;
    return {
      desde: inicio,
      hasta: fechaBogotaEnUTC(anio, mes, dia + 1),
      diaCompleto: true,
    };
  }
  return {
    desde: fechaBogotaEnUTC(anio, mes, 1),
    hasta: fechaBogotaEnUTC(anio, mes + 1, 1),
  };
}

function franjaHoraria(tokens: string[]): { desde: number; hasta: number } | undefined {
  if (tokens.some((token) => ['noche', 'night', 'soir'].includes(token))) {
    return { desde: 18, hasta: 24 };
  }
  if (tokens.some((token) => ['tarde', 'afternoon', 'apres', 'apres-midi'].includes(token))) {
    return { desde: 12, hasta: 18 };
  }
  if (
    tokens.some((token) => ['madrugada', 'dawn'].includes(token)) ||
    (tokens.includes('early') && tokens.includes('morning'))
  ) {
    return { desde: 0, hasta: 5 };
  }
  if (
    tokens.some((token) => ['morning', 'matin'].includes(token)) ||
    tokens.some((token, indice) =>
      token === 'manana' &&
      tokens[indice - 1] === 'la' &&
      ['por', 'en'].includes(tokens[indice - 2]),
    )
  ) {
    return { desde: 5, hasta: 12 };
  }
  return undefined;
}

function mananaEsFranja(tokens: string[]): boolean {
  return tokens.filter((token) => token === 'manana').length === 1 &&
    tokens.some((token, indice) =>
    token === 'manana' &&
    tokens[indice - 1] === 'la' &&
    ['por', 'en'].includes(tokens[indice - 2]),
    );
}

function aplicarFranja(
  periodo: PeriodoEventos,
  franja: { desde: number; hasta: number } | undefined,
): PeriodoEventos {
  if (!franja || !periodo.diaCompleto) return periodo;
  const fecha = new Date(periodo.desde);
  return {
    ...periodo,
    desde: fechaBogotaEnUTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate(), franja.desde),
    hasta: fechaBogotaEnUTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate(), franja.hasta),
  };
}

function periodoRelativo(tokens: string[], actual: Date): PeriodoEventos | undefined {
  const hoy = hoyEnBogota(actual);
  const franja = franjaHoraria(tokens);
  if (tokens.some((token) => ['hoy', 'today', 'aujourdhui'].includes(token))) {
    return {
      ...aplicarFranja(construirPeriodo(hoy.anio, hoy.mes, hoy.dia)!, franja),
      soloVigentes: true,
    };
  }
  if (
    !mananaEsFranja(tokens) &&
    tokens.some((token) => ['manana', 'tomorrow', 'demain'].includes(token))
  ) {
    const manana = new Date(fechaBogotaEnUTC(hoy.anio, hoy.mes, hoy.dia).getTime() + 86_400_000);
    return aplicarFranja(
      construirPeriodo(manana.getUTCFullYear(), manana.getUTCMonth(), manana.getUTCDate())!,
      franja,
    );
  }
  const semanaActual =
    (tokens.includes('semana') || tokens.includes('semaine') || tokens.includes('week')) &&
    (tokens.includes('esta') || tokens.includes('this') || tokens.includes('cette'));
  if (semanaActual) {
    const hoyUTC = fechaBogotaEnUTC(hoy.anio, hoy.mes, hoy.dia);
    const diaSemana = hoyUTC.getUTCDay();
    const lunes = new Date(hoyUTC.getTime() - ((diaSemana + 6) % 7) * 86_400_000);
    const siguienteLunes = new Date(lunes.getTime() + 7 * 86_400_000);
    return { desde: lunes, hasta: siguienteLunes, rangoDias: true };
  }
  const finDeSemana =
    tokens.includes('finde') ||
    (tokens.includes('semana') && tokens.includes('fin')) ||
    tokens.includes('weekend') ||
    (tokens.includes('week') && tokens.includes('end'));
  if (finDeSemana) {
    const hoyUTC = fechaBogotaEnUTC(hoy.anio, hoy.mes, hoy.dia);
    const diaHoy = hoyUTC.getUTCDay();
    const proximo = tokens.some((token) => ['proximo', 'next', 'prochain'].includes(token));
    const diasHastaSabado = proximo
      ? ((6 - diaHoy + 7) % 7 || 7)
      : diaHoy === 0 ? -1 : (6 - diaHoy + 7) % 7;
    const sabado = new Date(hoyUTC.getTime() + diasHastaSabado * 86_400_000);
    return {
      desde: sabado,
      hasta: new Date(sabado.getTime() + 2 * 86_400_000),
      rangoDias: true,
    };
  }
  const diaConsultado = tokens
    .map(obtenerDiaSemana)
    .find((dia): dia is number => dia !== undefined);
  if (diaConsultado !== undefined) {
    const hoyUTC = fechaBogotaEnUTC(hoy.anio, hoy.mes, hoy.dia);
    let diasHasta = (diaConsultado - hoyUTC.getUTCDay() + 7) % 7;
    if (diasHasta === 0 && tokens.some((token) => ['proximo', 'next', 'prochain'].includes(token))) {
      diasHasta = 7;
    }
    const fecha = new Date(hoyUTC.getTime() + diasHasta * 86_400_000);
    const periodo = construirPeriodo(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
    return periodo ? aplicarFranja(periodo, franja) : undefined;
  }
  return undefined;
}

export function extraerFiltroTemporal(
  texto: string,
  ahora = new Date(),
): FiltroTemporalEventos {
  const normalizado = normalizar(texto);
  const tokens = normalizado.split(' ');
  const soloFinalizados =
    /\b(pasado|pasados|pasada|pasadas|pasaron|anteriores|finalizados|finalizadas|terminados|terminadas|historial|historicos)\b/.test(normalizado) ||
    /\bya\s+(paso|pasaron|termino|terminaron)\b/.test(normalizado);

  const hoy = hoyEnBogota(ahora);
  const indiceMes = tokens.findIndex((token) => obtenerMes(token) !== undefined);
  if (indiceMes >= 0) {
    const mes = obtenerMes(tokens[indiceMes])!;
    const anio = anioDeConsulta(tokens, indiceMes, hoy.anio);
    const dia = obtenerDia(tokens, indiceMes);
    const periodo = construirPeriodo(anio, mes, dia);
    return {
      periodo: periodo && dia !== undefined ? aplicarFranja(periodo, franjaHoraria(tokens)) : periodo,
      soloFinalizados,
    };
  }

  const periodo = periodoRelativo(tokens, ahora);
  if (periodo) return { periodo, soloFinalizados };

  const anio = tokens.find((token) => /^(19|20)\d{2}$/.test(token));
  if (anio) {
    const numero = Number(anio);
    return {
      periodo: {
        desde: fechaBogotaEnUTC(numero, 0, 1),
        hasta: fechaBogotaEnUTC(numero + 1, 0, 1),
        anioCompleto: true,
      },
      soloFinalizados,
    };
  }

  return { soloFinalizados };
}

export function esTerminoTemporal(texto: string): boolean {
  const token = normalizar(texto);
  return obtenerMes(token) !== undefined ||
    obtenerDiaSemana(token) !== undefined ||
    [
    'hoy', 'today', 'aujourdhui', 'manana', 'tomorrow', 'demain',
    'semana', 'semaine', 'week', 'weekend', 'week-end', 'end', 'fin', 'finde', 'this', 'cette', 'ce',
    'noche', 'night', 'soir', 'tarde', 'afternoon', 'apres', 'matin', 'morning',
    'madrugada', 'dawn', 'por', 'en', 'la', 'el', 'proximo', 'next', 'prochain',
    'pasado', 'pasados', 'pasada', 'pasadas',
    'pasaron', 'anteriores', 'finalizados', 'finalizadas', 'terminados',
    'terminadas', 'historial', 'historicos',
    ].includes(token);
}
