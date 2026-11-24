import { AppError } from '../utils/errors.js';

export function validate(schemas) {
  return (req, _res, next) => {
    const details = [];

    if (schemas.params) {
      const res = schemas.params.safeParse(req.params);
      if (!res.success) {
        details.push(...res.error.issues.map((i) => ({ location: 'params', path: i.path.join('.'), message: i.message })));
      } else {
        req.params = res.data;
      }
    }

    if (schemas.query) {
      const res = schemas.query.safeParse(req.query);
      if (!res.success) {
        details.push(...res.error.issues.map((i) => ({ location: 'query', path: i.path.join('.'), message: i.message })));
      } else {
        req.query = res.data;
      }
    }

    if (schemas.body) {
      const res = schemas.body.safeParse(req.body);
      if (!res.success) {
        details.push(...res.error.issues.map((i) => ({ location: 'body', path: i.path.join('.'), message: i.message })));
      } else {
        req.body = res.data;
      }
    }

    if (details.length > 0) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', details));
    }

    return next();
  };
}
