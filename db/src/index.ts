import {Client} from 'pg'
import { createClient } from 'redis'
import type { DbMessage } from './types.js'

const pgClient=new Client({
    user: 'your_user',
    host: 'localhost',
    database: 'my_database',
    password: 'your_password',
    port: 5432,
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