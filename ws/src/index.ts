import {WebSocketServer} from 'ws'
import { UserManager } from './UserManager.js'

const wss=new WebSocketServer()

wss.on('connection',(ws)=>{
    UserManager.getInstance().addUser(ws)
})