import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function updateUserRoles() {
  const client = await pool.connect();

  try {
    console.log('🔄 Updating user roles...\n');

    // Update admin role
    await client.query(`
      UPDATE taxpayers
      SET role = $1
      WHERE email = $2
    `, ['admin', 'admin@tax.com']);
    console.log('✅ Updated admin@tax.com to admin role');

    // Update tax professional role
    await client.query(`
      UPDATE taxpayers
      SET role = $1
      WHERE email = $2
    `, ['tax_professional', 'preparer@tax.com']);
    console.log('✅ Updated preparer@tax.com to tax_professional role');

    // Update taxpayer role
    await client.query(`
      UPDATE taxpayers
      SET role = $1
      WHERE email = $2
    `, ['taxpayer', 'taxpayer@tax.com']);
    console.log('✅ Updated taxpayer@tax.com to taxpayer role');

    console.log('\n✅ All user roles updated successfully!\n');

  } catch (error) {
    console.error('❌ Error updating user roles:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

updateUserRoles()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
