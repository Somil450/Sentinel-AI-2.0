// Schema inspection script for Supabase tables
// Run: node inspect_schema.mjs

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jyssaogardonnrtdmfqg.supabase.co',
  'sb_publishable_CXfgV9AOXQ6K2JjdDgURpw_juvY--tK'
);

const TABLES = [
  'reports_data',
  'signals_data',
  'trends_data',
  'who_idsp_groundtruth',
  'disease_profiles'
];

async function inspectTable(tableName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TABLE: ${tableName}`);
  console.log('='.repeat(60));

  // Try fetching rows
  const { data, error, count } = await supabase
    .from(tableName)
    .select('*', { count: 'exact' })
    .limit(3);

  if (error) {
    console.log(`  ERROR: ${error.message}`);
    console.log(`  CODE: ${error.code}`);
    console.log(`  DETAILS: ${JSON.stringify(error.details)}`);
    return;
  }

  console.log(`  Row count: ${count}`);

  if (data && data.length > 0) {
    const columns = Object.keys(data[0]);
    console.log(`  Columns (${columns.length}):`);
    columns.forEach(col => {
      const sampleValue = data[0][col];
      const type = sampleValue === null ? 'null' : typeof sampleValue;
      console.log(`    - ${col}: ${type} (sample: ${JSON.stringify(sampleValue)?.slice(0, 100)})`);
    });
    console.log(`\n  Sample rows:`);
    data.forEach((row, i) => {
      console.log(`    [${i}] ${JSON.stringify(row).slice(0, 200)}`);
    });
  } else {
    console.log('  Table is EMPTY - no rows found');
    
    // Try inserting a dummy row to get column info from error
    const { error: insertError } = await supabase
      .from(tableName)
      .insert({ __probe__: true })
      .select();
    
    if (insertError) {
      console.log(`  Insert probe error: ${insertError.message}`);
      console.log(`  Insert probe details: ${JSON.stringify(insertError.details)}`);
      console.log(`  Insert probe hint: ${insertError.hint}`);
    }
    
    // Try to get column definitions via RPC if available
    const { data: colData, error: colError } = await supabase.rpc('get_table_columns', { table_name: tableName });
    if (colData) {
      console.log(`  Column definitions via RPC: ${JSON.stringify(colData)}`);
    }
  }
}

async function main() {
  console.log('SENTINEL AI - SUPABASE SCHEMA INSPECTION');
  console.log(`Supabase URL: https://jyssaogardonnrtdmfqg.supabase.co`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  for (const table of TABLES) {
    await inspectTable(table);
  }

  // Also check if there are any other accessible tables
  console.log(`\n${'='.repeat(60)}`);
  console.log('PROBING FOR ADDITIONAL TABLES...');
  console.log('='.repeat(60));
  
  const otherTables = ['users', 'locations', 'observations', 'alerts', 'notifications'];
  for (const table of otherTables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (!error) {
      console.log(`  FOUND: ${table} (${data?.length || 0} rows returned)`);
      if (data?.length > 0) {
        console.log(`    Columns: ${Object.keys(data[0]).join(', ')}`);
      }
    } else if (error.code !== '42P01') { // 42P01 = table does not exist
      console.log(`  ${table}: ${error.message} (code: ${error.code})`);
    }
  }
}

main().catch(console.error);
