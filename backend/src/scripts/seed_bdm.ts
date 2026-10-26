import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db';
import { User, Customer, Project } from '../models';

export const ALL_BDMS = [
  { name: 'Thirunavukarasu', email: 'thirunavukarasu@alpha.com', role: 'BDM' as const, phone: '+91 98401 10001' },
  { name: 'Gopinath', email: 'gopinath@alpha.com', role: 'BDM' as const, phone: '+91 98401 10002' },
  { name: 'Javith', email: 'javith@alpha.com', role: 'BDM' as const, phone: '+91 98401 10003' },
  { name: 'Mohamed Ashik', email: 'mohamedashik@alpha.com', role: 'BDM' as const, phone: '+91 98401 10004' },
  { name: 'Dhananjay', email: 'dhananjay@alpha.com', role: 'BDM' as const, phone: '+91 98401 10005' },
  { name: 'Balaji', email: 'balaji@alpha.com', role: 'BDM' as const, phone: '+91 98401 10006' },
  { name: 'Aravind', email: 'aravind@alpha.com', role: 'BDM' as const, phone: '+91 98401 10007' },
  { name: 'Naveen', email: 'naveen@alpha.com', role: 'BDM' as const, phone: '+91 98401 10008' },
  { name: 'Eswar', email: 'eswar@alpha.com', role: 'BDM' as const, phone: '+91 98401 10009' },
  { name: 'Nitesh', email: 'nitesh@alpha.com', role: 'BDM' as const, phone: '+91 98401 10010' },
];

export async function seedBdms(assignPilotData = true) {
  try {
    const passwordHash = await bcrypt.hash('password123', 10);
    console.log('[SeedBDM] Ensuring all 10 BDM user accounts exist with login credentials...');

    const seededUsers: any[] = [];

    for (const bdm of ALL_BDMS) {
      const user = await User.findOneAndUpdate(
        {
          $or: [
            { email: bdm.email.toLowerCase() },
            { name: bdm.name, role: 'BDM' },
          ],
        },
        {
          $set: {
            name: bdm.name,
            email: bdm.email.toLowerCase(),
            role: 'BDM',
            phone: bdm.phone,
            isActive: true,
            passwordHash,
          },
        },
        { upsert: true, new: true }
      );
      seededUsers.push(user);
      console.log(`[SeedBDM] ✓ Active: ${user.name} (${user.email}) - Phone: ${user.phone}`);
    }

    // Support ashik@alpha.com alias
    await User.findOneAndUpdate(
      { email: 'ashik@alpha.com' },
      {
        $set: {
          name: 'Mohamed Ashik',
          email: 'ashik@alpha.com',
          role: 'BDM',
          phone: '+91 98401 10004',
          isActive: true,
          passwordHash,
        },
      },
      { upsert: true, new: true }
    );
    console.log(`[SeedBDM] ✓ Active alias: Mohamed Ashik (ashik@alpha.com)`);

    // Assign pilot projects & customers across all 10 BDMs so every BDM has data upon login
    if (assignPilotData) {
      console.log('[SeedBDM] Linking 10 BDMs with pilot customers and projects...');
      for (let i = 0; i < seededUsers.length; i++) {
        const bdm = seededUsers[i];
        const custCode = `CUST-${String(i + 1).padStart(3, '0')}`;
        const projCode = `ALP-${String(i + 1).padStart(3, '0')}`;

        await Customer.findOneAndUpdate(
          { customerId: custCode },
          {
            $set: {
              bdmId: bdm._id,
              bdmPhone: bdm.phone,
              assignedEmployee: bdm.name,
            },
          }
        );

        await Project.findOneAndUpdate(
          { projectId: projCode },
          {
            $set: {
              bdmId: bdm._id,
              bdmPhone: bdm.phone,
              assignedEmployee: bdm.name,
            },
          }
        );

        console.log(`[SeedBDM] Linked ${custCode} & ${projCode} -> ${bdm.name}`);
      }
    }

    console.log('[SeedBDM] All 10 BDMs initialized and verified successfully! (Password: password123)');
    return seededUsers;
  } catch (err: any) {
    console.error('[SeedBDM] Error seeding BDMs:', err.message);
    throw err;
  }
}

async function runStandalone() {
  try {
    await connectDB();
    await seedBdms(true);
    process.exit(0);
  } catch (err: any) {
    console.error('[SeedBDM Standalone] Failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runStandalone();
}
