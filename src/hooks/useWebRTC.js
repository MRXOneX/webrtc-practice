import { useEffect, useRef, useCallback } from 'react'
import freeice from 'freeice'
import useStateWithCallback from './useStateWithCallback'
import socket from '../socket'

export default function useWebRtc(roomID) {
    const [clients, updateClients] = useStateWithCallback([])

    const addNewClient = useCallback((newClient, cb) => {
        updateClients(list => {
            if(!list.includes(newClient)) {
                return [...list, newClient]
            }

            return list
        }, cb)
    }, [updateClients])

    const peerConnections = useRef({})
    const localMediaStream = useRef(null)
    const peerMediaElements = useRef({
        // eslint-disable-next-line no-useless-computed-key
        ['local_video']: null,
    })

    useEffect(() => {
        async function handleNewPeer({ peerID, createOffer }) {
            if(peerID in peerConnections.current) return console.warn(`Already connect to peer ${peerID}`)

            peerConnections.current[peerID] = new RTCPeerConnection({
                iceServers: freeice()
            })
            
            peerConnections.current[peerID].onicecandidate = event => {
                if(event.candidate) {
                    socket.emit('relay-ice', {
                        peerID,
                        iceCandidate: event.candidate
                    }) 
                }
            }

            let tracksNumber = 0
            peerConnections.current[peerID].ontrack = ({ streams: [remoteStream] }) => {
                tracksNumber++

                if(tracksNumber === 2) {
                    tracksNumber = 0
                    addNewClient(peerID, () => {
                        if(peerMediaElements.current[peerID]) {
                            peerMediaElements.current[peerID].srcObject = remoteStream
                        } else {
                            let settled = false
                            const interval = setInterval(() => {
                                if(peerMediaElements.current[peerID]) {
                                    peerMediaElements.current[peerID].srcObject = remoteStream
                                    settled = true
                                }

                                if(settled) {
                                    clearInterval(interval)
                                }
                            }, 1000)
                        }
                    })
                }
            }

            localMediaStream.current.getTracks().forEach(track => {
                peerConnections.current[peerID].addTrack(track, localMediaStream.current)
            })

            if(createOffer) {
                const offer = await peerConnections.current[peerID].createOffer()

                await peerConnections.current[peerID].setLocalDescription(offer)

                socket.emit('relay-sdp', {
                    peerID,
                    sessionDescription: offer
                })
            }
        }

        socket.on('add-peer', handleNewPeer)

        return () => {
            socket.off('add-peer')
        }
    }, [])

    useEffect(() => {
        async function setRemoteMedia({ peerID, sessionDescription: removeDescription }) {
            await peerConnections.current[peerID]?.setRemoteDescription(
                new RTCSessionDescription(removeDescription)
            )


            if(removeDescription.type === 'offer') {
                const answer = await peerConnections.current[peerID].createAnswer()

                await peerConnections.current[peerID].setLocalDescription(answer)

                socket.emit('relay-sdp', {
                    peerID,
                    sessionDescription: answer
                })
            }
            
        }

        socket.on('session-description', setRemoteMedia)


        return () => {
            socket.off('session-description')
        }
    }, [])

    useEffect(() => {
        socket.on('ice-candidate', ({ peerID, iceCandidate }) => {
            peerConnections.current[peerID]?.addIceCandidate(
                new RTCIceCandidate(iceCandidate)
            )
        })

        return () => {
            socket.off('ice-candidate')
        }
    }, [])

    useEffect(() => {
        const handleRemovePeer = ({ peerID }) => {
            if(peerConnections.current[peerID]) {
                peerConnections.current[peerID].close()
            }

            delete peerConnections.current[peerID]
            delete peerMediaElements.current[peerID]

            updateClients(list => list.filter(c => c !== peerID))
        }
        
        socket.on('remove-peer', handleRemovePeer)


        return () => {
            socket.off('remove-peer')
        }
    }, [])


    useEffect(() => {
        async function startCapture() {
            localMediaStream.current = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: {
                    width: 1280,
                    height: 720
                }
            })

            addNewClient('local-video', () => {
                const localVideoElement = peerMediaElements.current['local-video']

                if(localVideoElement) {
                    localVideoElement.volume = 0
                    localVideoElement.srcObject = localMediaStream.current
                }
            })
        }

        startCapture()
            .then(() => socket.emit('join', { room: roomID }))
            .catch(e => console.error('Error getting userMedia: ', e))

        return () => {
            localMediaStream.current.getTracks().forEach(track => track.stop())

            socket.emot('leave')
        }
    }, [roomID])

    const provideMediaRef = useCallback((id, node) => {
        peerMediaElements.current[id] = node
    }, [])

    return {
        clients,
        provideMediaRef
    }
}