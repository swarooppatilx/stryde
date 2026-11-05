import { services } from '@repo/shared';
import { uploadImageToIpfs } from '@/services/ipfsService';
import {
  CREATE_POST,
  type CreatePostIntent,
  createPostHandlers,
  DELETE_POST,
} from '@/services/postIntents';
import { getActiveWallet } from '@/services/wallet';
import { usePostStore } from '@/stores/postStore';
import { Toast } from '@/utils/toast';
import { registerOutboxHandler, registerRejectionHandler } from './outbox/appOutbox';

/** Teaches the outbox how a post is published and removed. */
export function registerPostIntents(): void {
  const handlers = createPostHandlers({
    wallet: getActiveWallet,
    uploadImage: async (uri) => (await uploadImageToIpfs('post', uri)).cid,
    createPost: (wallet, post) => services.posts.createPost(wallet, post),
    deletePost: (wallet, postId) => services.posts.deletePost(wallet, postId),
    onPublished: (localId, post) => usePostStore.getState().settle(localId, post),
  });

  registerOutboxHandler(CREATE_POST, handlers.createPost);
  registerOutboxHandler(DELETE_POST, handlers.deletePost);

  registerRejectionHandler(CREATE_POST, (entry, reason) => {
    // The server will never take this post: take it off the screen, and say why.
    usePostStore.getState().drop((entry.payload as CreatePostIntent).localId);
    Toast.fail(reason, 3);
  });
  registerRejectionHandler(DELETE_POST, (_entry, reason) => {
    Toast.fail(reason, 3);
  });
}
