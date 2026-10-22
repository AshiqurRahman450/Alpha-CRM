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
  const url = 'https://live-mt-server.wati.io/api/ext/v3/conversations?pageSize=50';
  const res = await axios.get(url, { headers });
  console.log('Total conversations:', res.data?.conversation_list?.length);
  for (const c of res.data?.conversation_list || []) {
    console.log(JSON.stringify(c, null, 2));
  }
}

main();
