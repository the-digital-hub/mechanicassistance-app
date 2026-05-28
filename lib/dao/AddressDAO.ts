import { apiClient } from '../api/apiClient';
import { Address } from './interfaces';

export interface IAddressDAO {
    getByUser(userId: string): Promise<Address[]>;
    create(address: Partial<Address> & { userId: string }): Promise<Address>;
    update(id: string, updates: Partial<Address>): Promise<Address>;
    delete(id: string): Promise<void>;
}

class AddressDAO implements IAddressDAO {
    async getByUser(userId: string): Promise<Address[]> {
        return apiClient.get(`/api/addresses/user/${encodeURIComponent(userId)}`);
    }

    async create(address: Partial<Address> & { userId: string }): Promise<Address> {
        return apiClient.post('/api/addresses', address);
    }

    async update(id: string, updates: Partial<Address>): Promise<Address> {
        return apiClient.patch(`/api/addresses/${id}`, updates);
    }

    async delete(id: string): Promise<void> {
        return apiClient.delete(`/api/addresses/${id}`);
    }
}

export const addressDAO = new AddressDAO();
