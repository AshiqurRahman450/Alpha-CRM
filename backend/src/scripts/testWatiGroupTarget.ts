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
  console.log('--- Testing sending to group targets via WATI ---');
  
  // Test targets:
  // 1. Group invite code
  // 2. Full invite URL
  const targets = [
    'IFEcdscoNQ89DNPY40YVhV',
    'https://chat.whatsapp.com/IFEcdscoNQ89DNPY40YVhV',
  ];

  for (const t of targets) {
    try {
      console.log(`\nTesting V3 text message to target "${t}"...`);
      const res = await axios.post(
        'https://live-mt-server.wati.io/api/ext/v3/conversations/messages/text',
        {
          text: 'Hello from Alpha Elevators CRM automated group test',
          target: t,
        },
        { headers }
      );
      console.log('Result:', JSON.stringify(res.data, null, 2));
    } catch (err: any) {
      console.log('Failed:', err.response?.status, err.response?.data || err.message);
    }
  }
}

main();
