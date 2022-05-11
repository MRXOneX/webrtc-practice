const path = require('path')
const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)
const { version, validate } = require('uuid')

const PORT = process.env.PORT || '3001'

const getClientRooms = () => {
   const { rooms } = io.sockets.adapter 
   

   return Array.from(rooms.keys()).filter(roomID => validate(roomID) && version(roomID) === 4)
}

const shareRoomsInfo = () => {
    io.emit('share-rooms', {
        rooms: getClientRooms
    })
}

io.on('connection', socket => {
    shareRoomsInfo()

    socket.on('join', config => {
        const { room: roomID } = config
        const { rooms: joinedRooms } = socket
    
    
        if(Array.from()) {
            return console.warn(`Already joined to ${roomID}`)
        }

        const clients = Array.from(io.sockets.adapter.rooms.get(roomID) || [])


        clients.forEach(clientID => {
            io.to(clientID).emit('add-peer', {
                peerID: socket.id,
                createOffer: false
            })

            socket.emit('add-peer', {
                peerID: clientID,
                createOffer: true
            })
        })

        socket.join(roomID)
        shareRoomsInfo()
    })

    const leaveRoom = () => {
        const { rooms } = socket


        Array.from(rooms)
            .filter(roomID => validate(roomID) && version(roomID) === 4)
            .forEach(roomID => {
                const clients = Array.from(io.sockets.adapter.rooms.get(roomID) || [])

                clients
                    .forEach(clientID => {
                        io.to(clientID).emit('remove-peer', {
                            peerID: socket.id
                        })

                        socket.emit('remove-peer', {
                            peerID: clientID
                        })
                    })


                    socket.leave(roomID)
            })
        shareRoomsInfo()
    }

    socket.on('leave', leaveRoom)
    socket.on('disconnectin', leaveRoom)

    socket.on('relay-sdp', ({ peerID, sessionDescription }) => {
        io.to(peerID).emit('session-description', {
            peerID: socket.id,
            sessionDescription
        })

        socket.on('relay-ice', ({ peerID, iceCandidate }) => {
            io.to(peerID).emit('ice-candidate', {
                peerID: socket.id,
                iceCandidate
            })
        })
    })

})

const publicPath = path.join(__dirname, 'build')


app.use(express.static(publicPath))

app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'))
})

server.listen(PORT, () => {
    console.log('Server Started')
})