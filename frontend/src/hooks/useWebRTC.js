import { useEffect, useRef, useCallback } from 'react';
import { ACTIONS } from '../actions.js';
import socketInit from '../socket';
import freeice from 'freeice';
import { useStateWithCallback } from './useStateWithCallback';

export const useWebRTC = (roomId, user) => {
    const [clients, setClients] = useStateWithCallback([]);
    const audioElements = useRef({});
    const connections = useRef({});
    const socket = useRef(null);
    const localMediaStream = useRef(null);

    //  SAFE: Always works with latest state
    const addNewClient = useCallback((newClient, cb) => {
        setClients((existingClients) => {
            const alreadyExists = existingClients.some(
                (client) => client.id === newClient.id
            );

            if (alreadyExists) {
                return existingClients;
            }

            return [...existingClients, newClient];
        }, cb);
    }, [setClients]);

    // Init socket once
    useEffect(() => {
        socket.current = socketInit();
    }, []);

    // ===============================
    // Handle new peer (REGISTER ONCE)
    // ===============================
    useEffect(() => {
        const handleNewPeer = async ({
            peerId,
            createOffer,
            user: remoteUser,
        }) => {
            // Prevent duplicate peer connections
            if (peerId in connections.current) {
                return console.warn(
                    `You are already connected with ${peerId} (${user.name})`
                );
            }

            connections.current[peerId] = new RTCPeerConnection({
                iceServers: freeice(),
            });

            // Handle ICE candidates
            connections.current[peerId].onicecandidate = (event) => {
                socket.current.emit(ACTIONS.RELAY_ICE, {
                    peerId,
                    icecandidate: event.candidate,
                });
            };

            // Handle incoming audio stream
            connections.current[peerId].ontrack = ({
                streams: [remoteStream],
            }) => {
                addNewClient(remoteUser, () => {
                    const audioEl = audioElements.current[remoteUser.id];
                    if (audioEl) {
                        audioEl.srcObject = remoteStream;
                    }
                });
            };

            // Add local tracks
            if (localMediaStream.current) {
                localMediaStream.current.getTracks().forEach((track) => {
                    connections.current[peerId].addTrack(
                        track,
                        localMediaStream.current
                    );
                });
            }

            // Create offer if needed
            if (createOffer) {
                const offer = await connections.current[peerId].createOffer();
                await connections.current[peerId].setLocalDescription(offer);

                socket.current.emit(ACTIONS.RELAY_SDP, {
                    peerId,
                    sessionDescription: offer,
                });
            }
        };

        socket.current.on(ACTIONS.ADD_PEER, handleNewPeer);

        return () => {
            socket.current.off(ACTIONS.ADD_PEER, handleNewPeer);
        };
    }, [addNewClient, user.name]);

    // ===============================
    // Capture local audio & join room
    // ===============================
    useEffect(() => {
        const startCapture = async () => {
            localMediaStream.current =
                await navigator.mediaDevices.getUserMedia({ audio: true });
        };

        startCapture().then(() => {
            // Add self
            addNewClient(user, () => {
                const localAudio = audioElements.current[user.id];
                if (localAudio) {
                    localAudio.volume = 0;
                    localAudio.srcObject = localMediaStream.current;
                }
            });

            socket.current.emit(ACTIONS.JOIN, {
                roomId,
                user,
            });
        });

        return () => {
            if (localMediaStream.current) {
                localMediaStream.current
                    .getTracks()
                    .forEach((track) => track.stop());
                localMediaStream.current = null;
            }

            if (socket.current) {
                socket.current.emit(ACTIONS.LEAVE, { roomId });
            }
        };
    }, []);

    // ===============================
    // Handle ICE candidates
    // ===============================
    useEffect(() => {
        const handleIceCandidate = ({ peerId, icecandidate }) => {
            if (icecandidate && connections.current[peerId]) {
                connections.current[peerId].addIceCandidate(icecandidate);
            }
        };

        socket.current.on(ACTIONS.ICE_CANDIDATE, handleIceCandidate);

        return () => {
            socket.current.off(ACTIONS.ICE_CANDIDATE, handleIceCandidate);
        };
    }, []);

    // ===============================
    // Handle SDP
    // ===============================
    useEffect(() => {
        const setRemoteMedia = async ({
            peerId,
            sessionDescription,
        }) => {
            const connection = connections.current[peerId];
            if (!connection) return;

            await connection.setRemoteDescription(
                new RTCSessionDescription(sessionDescription)
            );

            if (sessionDescription.type === 'offer') {
                const answer = await connection.createAnswer();
                await connection.setLocalDescription(answer);

                socket.current.emit(ACTIONS.RELAY_SDP, {
                    peerId,
                    sessionDescription: answer,
                });
            }
        };

        socket.current.on(ACTIONS.SESSION_DESCRIPTION, setRemoteMedia);

        return () => {
            socket.current.off(ACTIONS.SESSION_DESCRIPTION, setRemoteMedia);
        };
    }, []);

    // ===============================
    // Handle peer leaving
    // ===============================
    useEffect(() => {
        const handleRemovePeer = ({ peerID, userId }) => {
            if (connections.current[peerID]) {
                connections.current[peerID].close();
            }

            delete connections.current[peerID];
            delete audioElements.current[userId];

            setClients((list) => list.filter((c) => c.id !== userId));
        };

        socket.current.on(ACTIONS.REMOVE_PEER, handleRemovePeer);

        return () => {
            socket.current.off(ACTIONS.REMOVE_PEER, handleRemovePeer);
        };
    }, [setClients]);

    // ===============================
    // Provide audio ref
    // ===============================
    const provideRef = (instance, userId) => {
        audioElements.current[userId] = instance;
    };

    return { clients, provideRef };
};
