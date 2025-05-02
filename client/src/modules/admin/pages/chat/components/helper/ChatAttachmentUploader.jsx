import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Paperclip, ImageIcon, VideoIcon, Music, FileText, X } from "lucide-react";
import { useContext, useRef, useState } from "react";
import {
  useUploadMessageImagesMutation,
  useDeleteMessageImagesMutation,
} from "@/redux/api/MessageImagesApi";
import { useSelectedUser } from "@/modules/admin/context/SelectedUserContext";
import { AuthContext } from "@/modules/landing/context/AuthContext";
import {useSendMessageMutation} from "@/redux/api/MessageApi";
import { useSocket } from "@/modules/admin/context/SocketContext";

export default function ChatAttachmentUploader() {
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const docInputRef = useRef(null);
  const { selectedUser } = useSelectedUser();
  const { user } = useContext(AuthContext);
  const [selectedFiles, setSelectedFiles] = useState([]);
    const socket = useSocket();
  const [showModal, setShowModal] = useState(false);
  const [uploadType, setUploadType] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]); 
  const [uploadChatFiles] = useUploadMessageImagesMutation();
  const [deleteChatFile] = useDeleteMessageImagesMutation();
  const [sendMessageToDB] = useSendMessageMutation();

  const handleFileChange = async (e, type) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
  
    setUploadType(type);
    setShowModal(true);
  
    const uploaded = [];
  
    for (let file of files) {
      const formData = new FormData();
      formData.append("files", file);
      formData.append("senderId", user?.user?._id);
      formData.append("receiverId", selectedUser._id);
  
      try {
        const res = await uploadChatFiles(formData).unwrap();
        const imageUrl = res.fileUrls[0];
        uploaded.push({
          name: file.name,
          preview: URL.createObjectURL(file),
          imageUrl,
        });
      } catch (err) {
        console.error("File upload failed:", err);
      }
    }
  
    setUploadedFiles(uploaded); // used in handleUpload
  };
  


  const handleDeleteImage = async (idx) => {
    const file = uploadedFiles[idx];

    try {
      await deleteChatFile({
        senderId: user?.user?._id,
        receiverId: selectedUser._id,
        fileName: file.imageUrl.split("/").pop(), // Extract the filename from the URL
      }).unwrap();

      // TODO: delete from database via another API call
      // await deleteFileRecordInDB({ imageUrl: file.imageUrl });

      const updated = [...uploadedFiles];
      updated.splice(idx, 1);
      setUploadedFiles(updated);
    } catch (err) {
      console.error("Error deleting file:", err);
    }
  };
  const handleUpload = async () => {
    console.log("Upload clicked");
    try {
      for (const file of uploadedFiles) {
        const messageData = {
          sender: user?.user?._id,
          receiver: selectedUser._id,
          content: file.imageUrl,
        };
  
        socket.emit("sendMessage", {
          ...messageData,
          fromMe: true,
        });
  
        await sendMessageToDB(messageData).unwrap();
        await onSendMessage(messageData);
      }
  
      setUploadedFiles([]);
      setShowModal(false);
    } catch (err) {
      console.error("Upload message failed:", err);
    }
  };
  
  

  return (
    <>
    {/* Dropdown Trigger */}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button">
          <Paperclip size={20} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48">
        <DropdownMenuItem onClick={() => imageInputRef.current.click()}>
          <ImageIcon className="mr-2 h-4 w-4" /> Upload Image
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => videoInputRef.current.click()}>
          <VideoIcon className="mr-2 h-4 w-4" /> Upload Video
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => audioInputRef.current.click()}>
          <Music className="mr-2 h-4 w-4" /> Upload Audio
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => docInputRef.current.click()}>
          <FileText className="mr-2 h-4 w-4" /> Upload Document
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    {/* Hidden Input Fields */}
    <input
      type="file"
      accept="image/*"
      multiple
      ref={imageInputRef}
      className="hidden"
      onChange={(e) => handleFileChange(e, "image")}
    />
    <input
      type="file"
      accept="video/*"
      multiple
      ref={videoInputRef}
      className="hidden"
      onChange={(e) => handleFileChange(e, "video")}
    />
    <input
      type="file"
      accept="audio/*"
      multiple
      ref={audioInputRef}
      className="hidden"
      onChange={(e) => handleFileChange(e, "audio")}
    />
    <input
      type="file"
      accept=".pdf,.doc,.docx,.ppt,.pptx"
      multiple
      ref={docInputRef}
      className="hidden"
      onChange={(e) => handleFileChange(e, "document")}
    />

    {/* Modal for Preview */}
    <Dialog open={showModal} onOpenChange={setShowModal}>
      <DialogContent>
        <DialogTitle>Preview & Upload</DialogTitle>

        <div className="flex flex-wrap gap-3 max-h-64 overflow-y-auto">
          {uploadedFiles.map((file, idx) => (
            <div key={idx} className="relative w-24 h-24">
              {file.type === "image" ? (
                <img
                  src={file.preview}
                  alt="preview"
                  className="w-full h-full object-cover rounded"
                />
              ) : file.type === "video" ? (
                <video
                  src={file.preview}
                  controls
                  className="w-full h-full object-cover rounded"
                />
              ) : file.type === "audio" ? (
                <audio src={file.preview} controls className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded text-xs text-gray-700 p-2 text-center">
                  {file.name}
                </div>
              )}

              <button
                onClick={() => handleDeleteImage(idx)}
                className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow"
              >
                <X size={14} className="text-red-500" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={handleUpload}
          className="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Upload
        </button>
      </DialogContent>
    </Dialog>
  </>
  );
}
