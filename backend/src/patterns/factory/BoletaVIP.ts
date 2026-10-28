import { IBoleta } from './CreadorBoleta';

export class BoletaVIP implements IBoleta {
  tipo = 'VIP';
  descripcion = 'Acceso VIP con beneficios exclusivos';

  constructor(public precio: number) {}
}