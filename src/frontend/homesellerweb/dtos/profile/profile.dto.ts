export interface ProductUsersItem{
    id:string;
    productId:string;
}

export interface ProfileImageItem{
    id:string;
    imageURL?:string | null
}

export interface ProfileRequest{
    name:string;
    description?:string | null;
    phoneNumber?:string | null;
}

export interface ProfileResponse{
    id:string;
    userId:string;
    description?:string | null;
    phoneNumber?:string | null;
    imageURLs?:ProfileImageItem[] | null;
    productUsers?:ProductUsersItem[] | null;
    createdAt:string;
    updatedAt:string;
}