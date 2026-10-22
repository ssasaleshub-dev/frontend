import axiosClient from './axiosClient';
import { API_ENDPOINTS } from '../../config/constants';

export interface FileUploadResponse {
  url: string;
  key: string;
  fileName: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'FILE' | string;
  fileSize: number;
}

export const fileService = {
  uploadFile: async (
    file: File,
    folder: 'avatars' | 'chat' | string = 'chat'
  ): Promise<FileUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post(API_ENDPOINTS.FILES_UPLOAD, formData, {
      params: { folder },
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export default fileService;
