import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setSocket(null);
      setIsConnected(false);
      setIsReconnecting(false);
      setConnectionError(null);
      return;
    }

    let newSocket;
    let isMounted = true;

    const initSocket = async () => {
      try {
        const baseUrl = import.meta.env.VITE_APP_BASE_URL || 'http://localhost:4000';

        newSocket = io(baseUrl, {
          auth: async (cb) => {
            try {
              const token = await getToken({
                template: import.meta.env.VITE_APP_CLERK_JWT_TEMPLATE
              });
              cb({ token });
            } catch (error) {
              console.error('Failed to get Clerk token:', error);
              cb(new Error('Authentication failed'));
            }
          },
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 500,
          reconnectionDelayMax: 5000,
          randomizationFactor: 0.5,
          timeout: 10000,
          transports: ['websocket', 'polling']
        });

        newSocket.on('connect', () => {
          if (isMounted) {
            console.log('Socket connected:', newSocket.id);
            setIsConnected(true);
            setConnectionError(null);
            setIsReconnecting(false);
          }
        });

        newSocket.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          if (isMounted) {
            setIsConnected(false);
          }
        });

        newSocket.on('connect_error', (error) => {
          console.error('Socket connection error:', error, error?.data);
          if (isMounted) {
            setConnectionError(error.message || 'Connection error');
          }
        });

        newSocket.on('reconnect_attempt', (attemptNumber) => {
          console.log('Socket reconnect attempt', attemptNumber);
          if (isMounted) {
            setIsReconnecting(true);
          }
        });

        newSocket.on('reconnect', (attemptNumber) => {
          console.log('Socket reconnected after', attemptNumber, 'attempts');
          if (isMounted) {
            setIsConnected(true);
            setIsReconnecting(false);
            setConnectionError(null);
          }
        });

        if (isMounted) {
          setSocket(newSocket);
        }
      } catch (error) {
        console.error('Socket initialization failed:', error);
        if (isMounted) {
          setConnectionError(error.message || 'Failed to initialize socket');
        }
      }
    };

    initSocket();

    return () => {
      isMounted = false;
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [isLoaded, isSignedIn, getToken]);

  const contextValue = useMemo(
    () => ({
      socket,
      isConnected,
      isReconnecting,
      connectionError
    }),
    [socket, isConnected, isReconnecting, connectionError]
  );

  return <SocketContext.Provider value={contextValue}>{children}</SocketContext.Provider>;
};