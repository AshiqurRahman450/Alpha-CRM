import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let token = process.env.WATI_API_TOKEN || '';
if (token.startsWith('Bearer ')) {
  token = token.slice(7);
}

const baseUrl = process.env.WATI_API_BASE_URL || 'https://live-mt-server.wati.io/10269884';

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

async function checkEndpoints() {
  const endpoints = [
    { name: 'V1 getContacts', url: `${baseUrl}/api/v1/getContacts?pageSize=20` },
    { name: 'V1 getMessages', url: `${baseUrl}/api/v1/getMessages?pageSize=20` },
    { name: 'V1 getConversations', url: `${baseUrl}/api/v1/getConversations?pageSize=20` },
    { name: 'V1 getChats', url: `${baseUrl}/api/v1/getChats` },
    { name: 'V1 getGroupList', url: `${baseUrl}/api/v1/getGroupList` },
    { name: 'V2 getMessages', url: `${baseUrl}/api/v2/getMessages` },
    { name: 'V3 conversations', url: `https://live-mt-server.wati.io/api/ext/v3/conversations?pageSize=20` },
    { name: 'V3 messages', url: `https://live-mt-server.wati.io/api/ext/v3/messages` },
  ];

  for (const ep of endpoints) {
    try {
      const res = await axios.get(ep.url, { headers });
      console.log(`[OK] ${ep.name} (${res.status}):`, JSON.stringify(res.data).substring(0, 300));
    } catch (err: any) {
      console.log(`[ERR] ${ep.name} (${err.response?.status}):`, err.response?.data?.message || err.response?.data || err.message);
    }
  }
}

checkEndpoints();
