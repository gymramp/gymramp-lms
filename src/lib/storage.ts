
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase"; // Assuming storage is initialized in firebase.ts

// Define storage paths
const STORAGE_PATHS = {
    LESSON_IMAGES: 'lessons/featured_images',
    LESSON_VIDEOS: 'lessons/videos', // Added path for videos
    COMPANY_LOGOS: 'companies/logos',
    COURSE_IMAGES: 'courses/featured_images', // Added path for course images
    USER_PROFILE_IMAGES: 'users/profile_images', // Added path for user profile images
};


/**
 * Uploads a file to Firebase Storage and tracks progress.
 * @param file - The file to upload.
 * @param path - The desired path in Firebase Storage (e.g., 'images/profile.jpg').
 * @param progressCallback - A function to call with upload progress percentage.
 * @returns Promise<string> - Resolves with the download URL of the uploaded file.
 */
export const uploadImage = (
    file: File,
    path: string,
    progressCallback: (progress: number) => void
): Promise<string> => {
    return new Promise((resolve, reject) => {
        console.log(`[uploadImage] Starting upload for path: ${path}`); // Log: Start
        const storageRef = ref(storage, path);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                // Observe state change events such as progress, pause, and resume
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log(`[uploadImage] Upload is ${progress}% done for ${path}`); // Log: Progress
                progressCallback(progress); // Update progress state
                switch (snapshot.state) {
                    case 'paused':
                        console.log(`[uploadImage] Upload paused for ${path}`);
                        break;
                    case 'running':
                        console.log(`[uploadImage] Upload running for ${path}`);
                        break;
                }
            },
            (error) => {
                // Handle unsuccessful uploads
                console.error(`[uploadImage] Upload failed for ${path}:`, error); // Log: Error
                // A full list of error codes is available at
                // https://firebase.google.com/docs/storage/web/handle-errors
                switch (error.code) {
                    case 'storage/unauthorized':
                        reject(new Error("User doesn't have permission to access the object"));
                        break;
                    case 'storage/canceled':
                         reject(new Error("User canceled the upload"));
                        break;
                     case 'storage/object-not-found':
                         reject(new Error("File doesn't exist"));
                         break;
                     case 'storage/retry-limit-exceeded': // Added specific retry limit error
                         reject(new Error("Max retry time for operation exceeded. Please try again later."));
                         break;
                    case 'storage/unknown':
                        reject(new Error("Unknown error occurred, inspect error.serverResponse"));
                        break;
                    default:
                        reject(error);
                }
            },
            () => {
                // Handle successful uploads on complete
                console.log(`[uploadImage] Upload complete for ${path}. Getting download URL...`); // Log: Success start URL fetch
                getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                    console.log(`[uploadImage] File available at ${downloadURL} for ${path}`); // Log: Success URL fetch
                    resolve(downloadURL);
                }).catch((urlError) => {
                    console.error(`[uploadImage] Failed to get download URL for ${path}:`, urlError); // Log: URL fetch error
                    reject(urlError); // Catch errors during URL retrieval
                });
            }
        );
    });
};

export { STORAGE_PATHS };
