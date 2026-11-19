import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * The lobby used to be a screen of its own. Its steps (conditions, recommendations, "Connect") are now a sheet that opens
 * from "Join video call" on the appointment, so this address (still used by pushes and older links) sends there.
 */
export default function VideoLobbyRedirect() {
    const { id } = useLocalSearchParams();
    const appointmentId = Array.isArray(id) ? id[0] : id || '';
    return <Redirect href={{ pathname: '/appointments/[id]', params: { id: appointmentId, join: '1' } }} />;
}
