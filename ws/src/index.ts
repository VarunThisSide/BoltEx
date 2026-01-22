import {WebSocketServer} from 'ws'
import { UserManager } from './UserManager.js'

const port = Number(process.env.PORT) || 3001;
const wss=new WebSocketServer({port})

wss.on('connection',(ws)=>{
    UserManager.getInstance().addUser(ws)
})