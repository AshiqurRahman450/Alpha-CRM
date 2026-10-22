import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let token = process.env.WATI_API_TOKEN || '';
if (token.startsWith('Bearer ')) {
  token = token.slice(7);
}

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

async function main() {
  const url = 'https://live-mt-server.wati.io/api/ext/v3/conversations/groups';
  const payload = {
    name: 'Ashik residence WhatsApp group',
    owner_email: 'alphaelevators01@gmail.com',
    operator_emails: ['alphaelevators01@gmail.com'],
    contact_targets: ['917810091290'],
    join_approval_mode: 'auto_approve'
  };

  try {
    console.log(`Calling POST ${url} with payload:`, JSON.stringify(payload, null, 2));
    const res = await axios.post(url, payload, { headers });
    console.log('GROUP CREATED SUCCESSFULLY! Status:', res.status);
    console.log('Response Data:', JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.log('Group create failed:', err.response?.status);
    console.log('Error Details:', JSON.stringify(err.response?.data || err.message, null, 2));
  }
}

main();
