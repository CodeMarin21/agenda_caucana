import { Request, Response, NextFunction } from 'express';

const idiomasSoportados = ['es', 'en', 'fr'];

export function i18nMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const headerLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0]?.toLowerCase();
  const idioma = idiomasSoportados.includes(headerLang ?? '') ? headerLang! : 'es';
  req.idioma = idioma;
  next();
}