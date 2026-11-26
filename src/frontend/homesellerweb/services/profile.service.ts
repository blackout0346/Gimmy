import { ApiError, apiFetch } from "@/lib/http"
import {  
    ProfileRequest, 
    ProfileResponse 
} from "@/dtos/profile/profile.dto"

const BASE_URL = `${process.env.NEXT_PUBLIC_PROFILE_API_URL}/api/Profile`;

export const profileService = {
    async getProfile(): Promise<ProfileResponse[]>{
        return apiFetch<ProfileResponse[]>(BASE_URL, {
            method: 'GET',
            auth:false
        });
    },

    async getProfileById(id: string): Promise<ProfileResponse>{
        return apiFetch<ProfileResponse>(`${BASE_URL}/${id}`, {
            method: "GET",
            auth: false
        });
    },

    async getProfileByUserId(userId: string): Promise<ProfileResponse>{
        return apiFetch<ProfileResponse>(`${BASE_URL}/user/${userId}`, {
            method: "GET",
            auth: false
        });
    },

    async getMyProfile(): Promise<ProfileResponse | null>{
        try{
        
            return await apiFetch<ProfileResponse>(`${BASE_URL}/me`, {
                method: "GET",
                auth:true
            })
        } catch(error)
        {
            if(error instanceof ApiError && error.status === 404){
                return null;
            }
            throw error;
        }
    },

    async createProfile(request: ProfileRequest): Promise<ProfileResponse>{
        return apiFetch<ProfileResponse>(BASE_URL, {
            method: "POST",
            auth:true,
            body: JSON.stringify(request)
        })
    },

    async updateMyProfile(request: ProfileRequest): Promise<ProfileResponse>{
        return apiFetch<ProfileResponse>(`${BASE_URL}/me`, {
            method: "PUT",
            auth: true,
            body: JSON.stringify(request)
        })
    },

    async deleteMyProfile(): Promise<void> {
        return apiFetch<void>(`${BASE_URL}/me`, {
            method: "DELETE",
            auth:true
        })
    },

    async addProductToMyProfile(productId: string): Promise<void>{
        return apiFetch<void>(`${BASE_URL}/me/products/${productId}`, {
            method: "POST",
            auth: true,
        })
    },

    async addImageToMyProfile(file: File): Promise<{ imageUrl: string}>{
        const formData = new FormData();
        formData.append("file", file);

        return apiFetch<{imageUrl: string}>(`${BASE_URL}/me/images`, {
            method: "POST",
            auth: true,
            body: formData
        })
    },

    async deleteMyProfileImage(imageId: string): Promise<void>{
        return apiFetch<void>(`${BASE_URL}/me/images/${imageId}`, {
            method: "DELETE",
            auth: true
        })
    }
}