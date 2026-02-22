
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { AlarmLocation } from '@/types/alarm';

const GEOFENCE_TASK_NAME = 'ALARM_GEOFENCE_TASK';

/**
 * Define the geofencing background task
 */
export function defineGeofencingTask(onGeofenceEvent: (event: any) => void) {
  console.log('Defining geofencing task:', GEOFENCE_TASK_NAME);
  
  TaskManager.defineTask(GEOFENCE_TASK_NAME, ({ data, error }) => {
    if (error) {
      console.error('Geofencing task error:', error.message);
      return;
    }
    
    if (data) {
      const { eventType, region } = data as any;
      console.log('Geofence event:', { eventType, region });
      onGeofenceEvent({ eventType, region });
    }
  });
}

/**
 * Start geofencing for a location
 */
export async function startGeofencing(
  location: AlarmLocation,
  identifier: string = 'home'
): Promise<boolean> {
  console.log('Starting geofencing for:', { location, identifier });
  
  try {
    // Check if task is already defined
    const isTaskDefined = await TaskManager.isTaskDefined(GEOFENCE_TASK_NAME);
    if (!isTaskDefined) {
      console.error('Geofencing task not defined. Call defineGeofencingTask first.');
      return false;
    }
    
    // Check if already started
    const hasStarted = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
    if (hasStarted) {
      console.log('Geofencing already started, stopping first');
      await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    }
    
    // Start geofencing
    await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, [
      {
        identifier,
        latitude: location.latitude,
        longitude: location.longitude,
        radius: location.radius || 100, // Default 100m radius
        notifyOnEnter: true,
        notifyOnExit: true,
      },
    ]);
    
    console.log('Geofencing started successfully');
    return true;
  } catch (error) {
    console.error('Error starting geofencing:', error);
    return false;
  }
}

/**
 * Stop geofencing
 */
export async function stopGeofencing(): Promise<boolean> {
  console.log('Stopping geofencing');
  
  try {
    const hasStarted = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
    if (hasStarted) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
      console.log('Geofencing stopped successfully');
    } else {
      console.log('Geofencing was not started');
    }
    return true;
  } catch (error) {
    console.error('Error stopping geofencing:', error);
    return false;
  }
}

/**
 * Check if geofencing is active
 */
export async function isGeofencingActive(): Promise<boolean> {
  try {
    return await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
  } catch (error) {
    console.error('Error checking geofencing status:', error);
    return false;
  }
}

/**
 * Get current location
 */
export async function getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
  console.log('Getting current location');
  
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    
    const coords = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
    
    console.log('Current location:', coords);
    return coords;
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
}
