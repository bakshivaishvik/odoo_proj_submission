import { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls, Html } from '@react-three/drei';
import { Model } from "./Explorer";
import { ConvaiClient } from 'convai-web-sdk';
import { SETTINGS } from './constants';

export default function App() {
  const [userText, setUserText] = useState("Press & Hold Space to Talk!");
  const finalizedUserText = useRef("");
  const [npcText, setNpcText] = useState("");
  const npcTextRef = useRef("");
  const convaiClientRef = useRef(null);
  const [isTalking, setIsTalking] = useState(false);
  const [keyPressed, setKeyPressed] = useState(false);

  function handleSpacebarPress(event) {
    if (event.code === 'Space' && !keyPressed) {
      setKeyPressed(true);
      finalizedUserText.current = "";
      npcTextRef.current = "";
      setUserText("");
      setNpcText("");

      // Initialize ConvaiClient on first interaction
      if (!convaiClientRef.current) {
        const client = new ConvaiClient({
          apiKey: SETTINGS['CONVAI-API-KEY'],
          characterId: SETTINGS['CHARACTER-ID'],
          enableAudio: true,
        });

        // Set response callback
        client.setResponseCallback((response) => {
          if (response.hasUserQuery()) {
            let transcript = response.getUserQuery();
            const isFinal = transcript.getIsFinal();
            if (isFinal) {
              finalizedUserText.current += " " + transcript.getTextData();
              transcript = null;
            }
            setUserText(finalizedUserText.current + (transcript?.getTextData() || ""));
          }

          if (response.hasAudioResponse()) {
            const audioResponse = response.getAudioResponse();
            npcTextRef.current += " " + audioResponse.getTextData();
            setNpcText(npcTextRef.current);
          }
        });

        client.onAudioPlay(() => setIsTalking(true));
        client.onAudioStop(() => setIsTalking(false));

        convaiClientRef.current = client;
      }

      const client = convaiClientRef.current;

      // Resume AudioContext if needed
      if (client.audioContext?.state === "suspended") {
        client.audioContext.resume().then(() => {
          console.log("AudioContext resumed");
          client.startAudioChunk();
        });
      } else {
        client.startAudioChunk();
      }
    }
  }

  function handleSpacebarRelease(event) {
    if (event.code === 'Space' && keyPressed) {
      setKeyPressed(false);
      convaiClientRef.current?.endAudioChunk();
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', handleSpacebarPress);
    window.addEventListener('keyup', handleSpacebarRelease);
    return () => {
      window.removeEventListener('keydown', handleSpacebarPress);
      window.removeEventListener('keyup', handleSpacebarRelease);
    };
  }, [keyPressed]);

  return (
    <Canvas shadows camera={{ position: [0, 0, 15], fov: 30 }}>
      <Environment
        files="/snowy_forest_path_01_4k.hdr"
        ground={{ height: 5, radius: 30, scale: 20 }}
      />
      <Model
        position={[0, 0, 3]}
        scale={1.8}
        animationName={isTalking ? "talk" : "idle"}
      />
      <Html position={[-1.5, -0.75, 3]}>
        {userText && (
          <div style={{
            width: '100%', height: '100%', overflow: 'auto', borderRadius: '10px',
            background: 'rgba(115, 117, 109, 0.5)', padding: '10px', textAlign: 'center'
          }}>
            <p style={{ maxHeight: '300px', width: '300px' }}>{userText}</p>
          </div>
        )}
      </Html>
      <Html position={[1, 3, 3]}>
        {npcText && (
          <div style={{
            width: '100%', height: '100%', overflow: 'auto', borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.7)', padding: '10px', textAlign: 'center'
          }}>
            <p style={{ maxHeight: '300px', width: '300px' }}>{npcText}</p>
          </div>
        )}
      </Html>
      <OrbitControls
        enableZoom={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 2.25}
      />
    </Canvas>
  );
}
