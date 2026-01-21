import { Router } from "express";

export const klinesRouter=Router()

klinesRouter.get('/',(req,res)=>{
    const {market,interval,startTime,endTime} = req.query
    res.json({})
})