export interface PeriodoEventos {
  desde: Date;
  hasta: Date;
  diaCompleto?: boolean;
  anioCompleto?: boolean;
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

function fechaBogotaEnUTC(anio: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(anio, mes, dia, 5));
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

function periodoRelativo(tokens: string[], actual: Date): PeriodoEventos | undefined {
  const hoy = hoyEnBogota(actual);
  if (tokens.some((token) => ['hoy', 'today', 'aujourdhui'].includes(token))) {
    return construirPeriodo(hoy.anio, hoy.mes, hoy.dia);
  }
  if (tokens.some((token) => ['manana', 'tomorrow', 'demain'].includes(token))) {
    const manana = new Date(fechaBogotaEnUTC(hoy.anio, hoy.mes, hoy.dia).getTime() + 86_400_000);
    return construirPeriodo(manana.getUTCFullYear(), manana.getUTCMonth(), manana.getUTCDate());
  }
  const semanaActual =
    (tokens.includes('semana') || tokens.includes('semaine') || tokens.includes('week')) &&
    (tokens.includes('esta') || tokens.includes('this') || tokens.includes('cette'));
  if (semanaActual) {
    const hoyUTC = fechaBogotaEnUTC(hoy.anio, hoy.mes, hoy.dia);
    const diaSemana = hoyUTC.getUTCDay();
    const lunes = new Date(hoyUTC.getTime() - ((diaSemana + 6) % 7) * 86_400_000);
    const siguienteLunes = new Date(lunes.getTime() + 7 * 86_400_000);
    return { desde: lunes, hasta: siguienteLunes };
  }
  const finDeSemana =
    (tokens.includes('semana') && tokens.includes('fin')) ||
    (tokens.includes('weekend') && (tokens.includes('this') || tokens.includes('fin'))) ||
    (tokens.includes('week') && tokens.includes('end') && (tokens.includes('this') || tokens.includes('ce')));
  if (finDeSemana) {
    const hoyUTC = fechaBogotaEnUTC(hoy.anio, hoy.mes, hoy.dia);
    const diasHastaSabado = (6 - hoyUTC.getUTCDay() + 7) % 7;
    const sabado = new Date(hoyUTC.getTime() + diasHastaSabado * 86_400_000);
    return { desde: sabado, hasta: new Date(sabado.getTime() + 2 * 86_400_000) };
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
    return {
      periodo: construirPeriodo(anio, mes, obtenerDia(tokens, indiceMes)),
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
  return obtenerMes(token) !== undefined || [
    'hoy', 'today', 'aujourdhui', 'manana', 'tomorrow', 'demain',
    'semana', 'semaine', 'week', 'weekend', 'week-end', 'end', 'fin', 'this', 'cette', 'ce',
    'pasado', 'pasados', 'pasada', 'pasadas',
    'pasaron', 'anteriores', 'finalizados', 'finalizadas', 'terminados',
    'terminadas', 'historial', 'historicos',
  ].includes(token);
}
