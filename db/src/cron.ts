import { Client } from "pg";

const pgClient=new Client({
    connectionString : process.env.DATABASE_URL
})

pgClient.connect()

async function refreshViews(){

    await pgClient.query('REFRESH MATERIALIZED VIEW klines_1m');
    await pgClient.query('REFRESH MATERIALIZED VIEW klines_1h');
    await pgClient.query('REFRESH MATERIALIZED VIEW klines_1w');
    console.log("Materialized views refreshed successfully");
}

refreshViews().catch(console.error);

setInterval(() => {
    refreshViews()
}, 1000 * 10 );