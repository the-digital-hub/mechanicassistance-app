import { apiClient } from '../api/apiClient';
import { IVehicleDAO, Vehicle, VinDecodeResult } from './interfaces';

export class VehicleDAO implements IVehicleDAO {
    /** Works during sign-up too: the gateway accepts the signup token here. */
    async decodeVin(vin: string, modelYear?: number): Promise<VinDecodeResult> {
        const query = modelYear ? `?modelYear=${modelYear}` : '';
        return apiClient.get(`/api/vehicles/vin/${encodeURIComponent(vin)}${query}`);
    }

    async getByUser(userId: string): Promise<Vehicle[]> {
        return apiClient.get(`/api/vehicles/user/${encodeURIComponent(userId)}`);
    }

    async create(vehicle: Vehicle): Promise<Vehicle> {
        return apiClient.post('/api/vehicles', vehicle);
    }

    async update(id: string, updates: Partial<Vehicle>): Promise<void> {
        return apiClient.patch(`/api/vehicles/${id}`, updates);
    }

    async delete(id: string): Promise<void> {
        return apiClient.delete(`/api/vehicles/${id}`);
    }
}

export const vehicleDAO = new VehicleDAO();
