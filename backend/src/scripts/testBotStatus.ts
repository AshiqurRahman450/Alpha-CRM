import axios from 'axios';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const secret = process.env.JWT_SECRET || 'alpha_elevators_jwt_super_secret_key_2026';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  const user = await mongoose.connection.collection('users').findOne({ role: 'ADMIN' });
  if (!user) {
    console.log('No admin found');
    return;
  }
  const token = jwt.sign({ _id: user._id.toString(), role: user.role, email: user.email }, secret, { expiresIn: '1d' });
  await mongoose.disconnect();

  try {
    console.log('Testing GET http://localhost:5000/api/whatsapp/bot/status with user:', user.email);
    const res = await axios.get('http://localhost:5000/api/whatsapp/bot/status', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Status code:', res.status);
    console.log('Data:', JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.log('Failed:', err.response?.status, err.response?.data || err.message);
  }
}

main();
