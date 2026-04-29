const { Client } = require('pg');
const fs = require('fs');
const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'zlecenia_db',
  password: 'postgres',
  port: 5432
});

client.connect()
  .then(() => client.query('SELECT table_name, column_name, data_type, character_maximum_length, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_schema = \'public\''))
  .then(res => { 
    fs.writeFileSync('schema.json', JSON.stringify(res.rows, null, 2));
    client.end();
  })
  .catch(e => { 
    console.error(e); 
    client.end();
  });
