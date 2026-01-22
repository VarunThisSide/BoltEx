import {Client} from 'pg'
import { createClient } from 'redis'
import type { DbMessage } from './types.js'
import express from 'express'

const app = express();
const PORT = process.env.PORT || 3000; 

app.get('/health', (req, res) => res.send('Engine is running'));
app.listen(PORT, () => console.log(`Health check listening on ${PORT}`));

const pgClient=new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
})
pgClient.connect()

async function main(){
    const redisClient=createClient({
            username : 'default',
            password : process.env.REDIS_PASSWORD || '',
            socket : {
                host: process.env.REDIS_HOST,
                port: 12819
            }
        })
    await redisClient.connect()
    while(true){
        const response=await redisClient.rPop('db_processor' as string)
        if(!response){

        }else{
            const data : DbMessage=JSON.parse(response)
            if(data.type==='TRADE_ADDED'){
                const price=data.data.price
                const time=new Date(data.data.timestamp)
                const query='INSERT INTO tata_prices (time,price) VALUES ($1,$2)'
                await pgClient.query(query,[time,price])
            }
        }
    }
}

main()