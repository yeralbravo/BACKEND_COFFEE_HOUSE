import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { body, validationResult } from 'express-validator';
import { 
  createUser, 
  loginUser, 
  findUserById,
  findUserByEmail,
  findUserByPhone,
  generatePasswordResetCode,
  resetPasswordWithCode
} from '../models/User.js';
import { verifyToken } from '../middleware/authMiddleware.js';

dotenv.config();
const router = express.Router();

router.post('/register',
  [
    body('nombre').trim().notEmpty().withMessage('El nombre es un campo obligatorio.').isLength({ max: 50 }).withMessage('El nombre no puede exceder 50 caracteres').matches(/^[a-zA-ZñÑáéíóúÁÉÍÓÚüÜ\s]+$/).withMessage('El nombre solo puede contener letras y espacios.'),
    body('apellido').trim().notEmpty().withMessage('El apellido es un campo obligatorio.').isLength({ max: 50 }).withMessage('El apellido no puede exceder 50 caracteres').matches(/^[a-zA-ZñÑáéíóúÁÉÍÓÚüÜ\s]+$/).withMessage('El apellido solo puede contener letras y espacios.'),
    body('telefono').notEmpty().withMessage('El teléfono es un campo obligatorio.').isNumeric().withMessage('El teléfono solo debe contener números.').isLength({ min: 10, max: 10 }).withMessage('El teléfono debe tener exactamente 10 dígitos.'),
    body('correo').notEmpty().withMessage('El correo es un campo obligatorio.').isEmail().withMessage('El formato del correo no es válido.').normalizeEmail().isLength({ max: 100 }).withMessage('El correo no puede exceder 100 caracteres'),
    body('contraseña').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres.').matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/).withMessage('La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial'),
    body('confirmarContraseña').custom((value, { req }) => {
      if (value !== req.body.contraseña) {
        throw new Error('Las contraseñas no coinciden. Por favor, verifica.');
      }
      return true;
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array({ onlyFirstError: true })[0].msg;
      return res.status(400).json({ success: false, error: firstError });
    }
    const { nombre, apellido, telefono, correo, contraseña } = req.body;
    try {
      const emailExists = await findUserByEmail(correo);
      if (emailExists) return res.status(409).json({ success: false, error: 'El correo electrónico ya está registrado.' });
      const phoneExists = await findUserByPhone(telefono);
      if (phoneExists) return res.status(409).json({ success: false, error: 'El número de teléfono ya está registrado.' });
      const role = correo === process.env.ADMIN_EMAIL ? 'admin' : 'client';
      await createUser(nombre, apellido, telefono, correo, contraseña, role);
      res.status(201).json({ success: true, message: '✅ Usuario registrado exitosamente' });
    } catch (error) {
      console.error('Error al registrar usuario:', error);
      res.status(500).json({ success: false, error: '❌ Error interno al registrar usuario' });
    }
  }
);

router.post('/login',
  [
    body('correo').notEmpty().withMessage('Ingresa tú correo electrónico.').isEmail().withMessage('El formato del correo no es válido.'),
    body('contraseña').notEmpty().withMessage('Ingresa tú contraseña.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array({ onlyFirstError: true })[0].msg;
      return res.status(400).json({ success: false, error: firstError });
    }
    const { correo, contraseña } = req.body;
    try {
      const user = await loginUser(correo);
      const genericErrorMessage = 'El correo o la contraseña no coinciden. Por favor, verifica tus datos.';
      if (!user) return res.status(401).json({ success: false, error: genericErrorMessage });
      const passwordMatch = await bcrypt.compare(contraseña, user.contraseña);
      if (!passwordMatch) return res.status(401).json({ success: false, error: genericErrorMessage });
      const token = jwt.sign({ id: user.id, nombre: user.nombre, apellido: user.apellido, role: user.role }, process.env.JWT_SECRET_KEY, { expiresIn: '7d' });
      res.status(200).json({ success: true, data: { token } });
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      res.status(500).json({ success: false, error: 'Ocurrió un error. Por favor, intenta de nuevo más tarde.' });
    }
  }
);

router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ success: false, error: '❌ Error al obtener el usuario' });
  }
});

router.post('/forgot-password', 
  [ body('email').isEmail().withMessage('Por favor, introduce un correo válido.') ], 
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }
    try {
        const resetCode = await generatePasswordResetCode(req.body.email);
        
        console.log('----------------------------------------------------');
        console.log('CÓDIGO DE RECUPERACIÓN (PARA INGRESAR EN EL FORMULARIO):');
        console.log(resetCode);
        console.log('----------------------------------------------------');

        res.status(200).json({ success: true, message: 'Se ha generado un código de recuperación.' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

router.post('/reset-password-with-code',
  [
    body('email').isEmail().withMessage('El correo es inválido.'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('El código debe tener 6 dígitos.'),
    body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }
    try {
        await resetPasswordWithCode(req.body.email, req.body.code, req.body.password);
        res.status(200).json({ success: true, message: 'Tu contraseña ha sido actualizada con éxito.' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

export default router;