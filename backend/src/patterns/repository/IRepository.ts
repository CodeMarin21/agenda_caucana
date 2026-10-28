// Patrón Repository — interfaz genérica para acceso a datos
// Todos los repositorios del proyecto la implementan
// Esto desacopla la lógica de negocio del ORM (Prisma)
export interface IRepository<T, CreateDTO, UpdateDTO> {
  findAll(): Promise<T[]>;
  findById(id: number): Promise<T | null>;
  create(data: CreateDTO): Promise<T>;
  update(id: number, data: UpdateDTO): Promise<T>;
  delete(id: number): Promise<void>;
}