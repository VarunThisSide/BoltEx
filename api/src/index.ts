import express from 'express'
import cors from 'cors'
const app=express()

app.use(express.json())
app.use(cors())

app.use('/api/v1/order')
app.use('/api/v1/depth')
app.use('/api/v1/trades')
app.use('/api/v1/klines')
app.use('/api/v1/tickers')

app.listen(3000,()=>{
    console.log('Server is running on port 3000')
})