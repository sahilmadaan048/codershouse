import { useEffect, useRef, useCallback } from 'react';
import { ACTIONS } from '../actions';
import socketInit from '../socket';
import freeice from 'freeice';
import { useStateWithCallback } from './useStateWithCallback';

export const useWebRTC = (roomId, user) => {
    const [clients, setClients] = useStateWithCallback([]);

    const socket = useRef(null);
    const connections = useRef({});
    const audioElements = useRef({});
    const localMediaStream = useRef(null);

    // ===============================
    // Add client safely (NO DUPES)
    // ===============================
    const addNewClient = useCallback((newClient, cb) => {
        setClients((clients) => {
            if (clients.find((c) => c.id === newClient.id)) {
                return clients;
            }
            return [...clients, { ...newClient, muted: true }];
        }, cb);
    }, [setClients]);

    // ===============================
    // Init socket ONCE
    // ===============================
    useEffect(() => {
        socket.current = socketInit();
        return () => {
            socket.current?.disconnect();
        };
    }, []);

    // ===============================
    // Capture local media + join
    // ===============================
    useEffect(() => {
        let mounted = true;

        const startCapture = async () => {
            try {
                const stream =
                    await navigator.mediaDevices.getUserMedia({
                        audio: true,
                    });

                if (!mounted) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }

                localMediaStream.current = stream;

                addNewClient(user, () => {
                    const audio = audioElements.current[user.id];
                    if (audio) {
                        audio.volume = 0;
                        audio.srcObject = stream;
                    }
                });

                socket.current.emit(ACTIONS.JOIN, {
                    roomId,
                    user,
                });
            } catch (err) {
                console.error('Mic access failed', err);
            }
        };

        startCapture();

        return () => {
            mounted = false;

            if (localMediaStream.current) {
                localMediaStream.current
                    .getTracks()
                    .forEach((t) => t.stop());
                localMediaStream.current = null;
            }

            socket.current?.emit(ACTIONS.LEAVE, { roomId });
        };
    }, [roomId, user, addNewClient]);

    // ===============================
    // Handle new peer
    // ===============================
    useEffect(() => {
        const handleNewPeer = async ({
            peerId,
            createOffer,
            user: remoteUser,
        }) => {
            if (connections.current[peerId]) return;

            const pc = new RTCPeerConnection({
                iceServers: freeice(),
            });

            connections.current[peerId] = pc;

            pc.onicecandidate = (e) => {
                if (e.candidate) {
                    socket.current.emit(ACTIONS.RELAY_ICE, {
                        peerId,
                        icecandidate: e.candidate,
                    });
                }
            };

            pc.ontrack = ({ streams: [remoteStream] }) => {
                addNewClient(remoteUser, () => {
                    const audio =
                        audioElements.current[remoteUser.id];
                    if (audio) {
                        audio.srcObject = remoteStream;
                    }
                });
            };

            if (localMediaStream.current) {
                localMediaStream.current
                    .getTracks()
                    .forEach((track) => {
                        pc.addTrack(track, localMediaStream.current);
                    });
            }

            if (createOffer) {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                socket.current.emit(ACTIONS.RELAY_SDP, {
                    peerId,
                    sessionDescription: offer,
                });
            }
        };

        socket.current.on(ACTIONS.ADD_PEER, handleNewPeer);
        return () =>
            socket.current.off(ACTIONS.ADD_PEER, handleNewPeer);
    }, [addNewClient]);

    // ===============================
    // ICE candidates
    // ===============================
    useEffect(() => {
        const handleIce = ({ peerId, icecandidate }) => {
            if (
                icecandidate &&
                connections.current[peerId]
            ) {
                connections.current[peerId].addIceCandidate(
                    icecandidate
                );
            }
        };

        socket.current.on(ACTIONS.ICE_CANDIDATE, handleIce);
        return () =>
            socket.current.off(ACTIONS.ICE_CANDIDATE, handleIce);
    }, []);

    // ===============================
    // SDP exchange
    // ===============================
    useEffect(() => {
        const handleSDP = async ({
            peerId,
            sessionDescription,
        }) => {
            const pc = connections.current[peerId];
            if (!pc) return;

            await pc.setRemoteDescription(
                new RTCSessionDescription(sessionDescription)
            );

            if (sessionDescription.type === 'offer') {
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                socket.current.emit(ACTIONS.RELAY_SDP, {
                    peerId,
                    sessionDescription: answer,
                });
            }
        };

        socket.current.on(
            ACTIONS.SESSION_DESCRIPTION,
            handleSDP
        );
        return () =>
            socket.current.off(
                ACTIONS.SESSION_DESCRIPTION,
                handleSDP
            );
    }, []);

    // ===============================
    // Peer leaving
    // ===============================
    useEffect(() => {
        const handleRemovePeer = ({ peerID, userId }) => {
            if (connections.current[peerID]) {
                connections.current[peerID].close();
                delete connections.current[peerID];
            }

            delete audioElements.current[userId];

            setClients((clients) =>
                clients.filter((c) => c.id !== userId)
            );
        };

        socket.current.on(
            ACTIONS.REMOVE_PEER,
            handleRemovePeer
        );
        return () =>
            socket.current.off(
                ACTIONS.REMOVE_PEER,
                handleRemovePeer
            );
    }, [setClients]);

    // ===============================
    // Mute / Unmute (SAFE)
    // ===============================
    const handleMute = (mute, userId) => {
        if (!localMediaStream.current) return;

        localMediaStream.current
            .getAudioTracks()
            .forEach((t) => (t.enabled = !mute));

        socket.current.emit(
            mute ? ACTIONS.MUTE : ACTIONS.UNMUTE,
            { roomId, userId }
        );

        setClients((clients) =>
            clients.map((c) =>
                c.id === userId
                    ? { ...c, muted: mute }
                    : c
            )
        );
    };

    // ===============================
    // Provide audio ref
    // ===============================
    const provideRef = (instance, userId) => {
        audioElements.current[userId] = instance;
    };

    return {
        clients,
        provideRef,
        handleMute,
        localStream: localMediaStream.current,
    };
};
