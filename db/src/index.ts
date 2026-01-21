import {Client} from 'pg'
import { createClient } from 'redis'
import type { DbMessage } from './types.js'

const pgClient=new Client({
    connectionString : process.env.DATABASE_URL
})
pgClient.connect()

async function main(){
    const redisClient=createClient()
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