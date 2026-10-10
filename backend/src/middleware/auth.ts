import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { User, IUser, UserRole } from '../models';

export interface AuthRequest extends Request {
  user?: IUser;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret) as { id: string; email: string; role: UserRole };

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid or inactive user account.' });
    }

    req.user = user;
    next();
  } catch (err: any) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

export function authorize(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: User role '${req.user.role}' is not authorized to access this resource. Required: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}
