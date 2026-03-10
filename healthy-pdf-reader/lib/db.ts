import { get, set, del } from 'idb-keyval';

export const saveLocalFile = async (fileId: string, file: Blob) => {
    await set(fileId, file);
};

export const getLocalFile = async (fileId: string): Promise<Blob | undefined> => {
    return await get(fileId);
};

export const deleteLocalFile = async (fileId: string) => {
    await del(fileId);
};
