import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let token = process.env.WATI_API_TOKEN || '';
if (token.startsWith('Bearer ')) {
  token = token.slice(7);
}
const baseUrl = process.env.WATI_API_BASE_URL || 'https://live-mt-server.wati.io/10269884';

console.log('Testing WATI with BaseUrl:', baseUrl);
console.log('Token starts with:', token.substring(0, 20));

async function main() {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Test 1: Groups list with correct full URL
  try {
    const url = `${baseUrl}/api/ext/v3/conversations/groups/list`;
    console.log(`\n--- 1. Testing POST ${url} ---`);
    const res = await axios.post(url, { limit: 20 }, { headers });
    console.log('Groups list response:', JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.log('Groups list failed:', err.response?.status, err.response?.data || err.message);
  }

  // Test 2: Try creating group with V3
  try {
    const url = `${baseUrl}/api/ext/v3/conversations/groups`;
    console.log(`\n--- 2. Testing POST ${url} ---`);
    const res = await axios.post(url, {
      name: 'Ashik residence WhatsApp group',
      contact_targets: ['917810091290']
    }, { headers });
    console.log('Group create response:', JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.log('Group create failed:', err.response?.status, err.response?.data || err.message);
  }

  // Test 3: Get contacts / conversations list
  try {
    const url = `${baseUrl}/api/v1/getContacts?pageSize=5`;
    console.log(`\n--- 3. Testing GET ${url} ---`);
    const res = await axios.get(url, { headers });
    console.log('Contacts response status:', res.status, 'Total contacts:', res.data?.contact_list?.length || res.data?.length);
  } catch (err: any) {
    console.log('Get contacts failed:', err.response?.status, err.response?.data || err.message);
  }
}

main();
