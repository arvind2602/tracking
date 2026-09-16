const { Client } = require('pg');

async function test() {
  const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_pAi6QzhkOd9C@ep-broad-silence-ady0laha-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' });
  await client.connect();
  try {
    const updated = [
      { id: "test1", name: "Holiday 1" },
      { id: "test2", name: "Holiday 2" }
    ];
    
    // Test the formatting that we plan to use
    const res = await client.query('SELECT $1::jsonb[] as result', [
      updated.map(u => JSON.stringify(u))
    ]);
    console.log(res.rows[0].result);
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
test();
