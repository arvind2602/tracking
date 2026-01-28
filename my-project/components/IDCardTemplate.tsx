
import React, { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { removeBackground } from "@imgly/background-removal";

interface IDCardTemplateProps {
    profile: any;
    idCardRef: React.RefObject<HTMLDivElement>;
    onImageProcessed?: () => void;
}

export const IDCardTemplate = ({ profile, idCardRef, onImageProcessed }: IDCardTemplateProps) => {
    const [processedImage, setProcessedImage] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const processImage = async () => {
            // If we already have a blob url that we generated, don't re-process
            if (profile.image?.startsWith('blob:')) {
                if (isMounted) {
                    setProcessedImage(profile.image);
                    onImageProcessed?.();
                }
                return;
            }

            if (!profile.image) {
                if (isMounted) {
                    setProcessedImage(null); // Use fallback
                    onImageProcessed?.();
                }
                return;
            }

            try {
                const imageBlob = await removeBackground(profile.image);
                const url = URL.createObjectURL(imageBlob);
                if (isMounted) {
                    setProcessedImage(url);
                    console.log("Background removed for", profile.firstName);
                    onImageProcessed?.();
                }
            } catch (error) {
                console.error("Failed to remove background", error);
                if (isMounted) {
                    setProcessedImage(profile.image); // Fallback to original
                    onImageProcessed?.();
                }
            }
        };

        processImage();
        return () => { isMounted = false; };
    }, [profile.image]);

    // Use a fixed date if DOB is missing or invalid for consistency, or format properly
    const formatDate = (dateString: string) => {
        if (!dateString) return "07 / 03 / 2002"; // Fallback
        try {
            return new Date(dateString).toLocaleDateString('en-GB');
        } catch {
            return "07 / 03 / 2002";
        }
    };

    return (
        <div ref={idCardRef} className="flex gap-10 items-start p-10" style={{ width: "fit-content", fontFamily: "'Montserrat', sans-serif", backgroundColor: "transparent" }}>
            {/* External Resources */}
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link
                href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap"
                rel="stylesheet"
            />
            <link
                href="https://fonts.googleapis.com/icon?family=Material+Icons"
                rel="stylesheet"
            />

            {/* Custom Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .grid-pattern {
                    background-image:
                        linear-gradient(#e2e8f0 1px, transparent 1px),
                        linear-gradient(90deg, #e2e8f0 1px, transparent 1px);
                    background-size: 20px 20px;
                }
                .font-display {
                    font-family: 'Montserrat', sans-serif;
                }
            `}} />

            {/* FRONT SIDE */}
            <div
                className="w-[450px] h-[720px] rounded-[24px] shadow-2xl overflow-hidden font-display relative flex flex-col shrink-0"
                style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: '1px' }}
            >
                <div className="relative flex-1 flex flex-col">
                    <div className="absolute inset-0 grid-pattern opacity-40 pointer-events-none"></div>

                    <div className="relative z-10 px-8 pt-12 gap-2 flex-1 flex flex-col">
                        {/* Logo Header */}
                        <div className="flex items-center justify-center ">
                            <img
                                src="https://admissionuploads.s3.ap-south-1.amazonaws.com//1769512650123_VLogo.png"
                                alt="VighnoTech Logo"
                                className=""
                                crossOrigin="anonymous"
                            />
                            <img
                                src="https://admissionuploads.s3.ap-south-1.amazonaws.com//1769512668299_vighnotechNewLogo.png"
                                alt="VighnoTech Text Logo"
                                className=""
                                crossOrigin="anonymous"
                            />
                        </div>

                        {/* Employee Name */}
                        <div className="text-center mb-[30px] mt-[-20px]">
                            <h1 className="text-5xl font-bold leading-tight" style={{ color: '#0f172a' }}>
                                {profile.firstName || "Arvind"}
                            </h1>
                            <h1 className="text-5xl font-bold leading-tight" style={{ color: '#0f172a' }}>
                                {profile.lastName || "Gupta"}
                            </h1>
                        </div>

                        {/* Designation Badge */}
                        <div className="flex justify-center items-center">
                            <div
                                className="px-4 py-2 rounded-full shadow-md items-center justify-center text-center"
                                style={{ backgroundColor: '#FF7905' }}
                            >
                                <p className="font-bold mb-2 mt-[-2px] text-lg uppercase tracking-wider text-white">
                                    {profile.position || ""}
                                </p>
                            </div>
                        </div>

                        {/* Employee Photo Container */}
                        <div className="relative flex-1 overflow-hidden mt-auto">
                            {/* Large V Logo Background */}
                            <div className="absolute inset-0 flex items-end justify-center z-0 translate-y-20">
                                <img
                                    src="https://admissionuploads.s3.ap-south-1.amazonaws.com//1769514419110_Vighnotech_Tick.png"
                                    alt="Background V"
                                    className="w-[450px] max-w-none opacity-90"
                                    crossOrigin="anonymous"
                                />
                            </div>

                            {/* Employee Photo */}
                            <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center">
                                <img
                                    src={processedImage || profile.image || "./Arvind.png"}
                                    className="w-[450px] object-contain"
                                    crossOrigin="anonymous"
                                    alt="Profile"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* BACK SIDE */}
            <div
                className="w-[450px] h-[720px] rounded-[24px] shadow-2xl overflow-hidden font-display relative flex flex-col shrink-0"
                style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: '1px' }}
            >
                <div className="relative flex-1 flex flex-col">
                    <div className="absolute inset-0 grid-pattern opacity-40 pointer-events-none"></div>

                    <div className="relative z-10 px-8 pt-6 gap-2 flex-1 flex flex-col">
                        {/* Logo Header */}
                        <div className="flex items-center justify-center mb-2">
                            <img
                                src="https://admissionuploads.s3.ap-south-1.amazonaws.com//1769512650123_VLogo.png"
                                alt="VighnoTech Logo"
                                crossOrigin="anonymous"
                            />
                            <img
                                src="https://admissionuploads.s3.ap-south-1.amazonaws.com//1769512668299_vighnotechNewLogo.png"
                                alt="VighnoTech Text Logo"
                                crossOrigin="anonymous"
                            />
                        </div>

                        {/* Contact Information */}
                        <div className="space-y-6 mb-5">
                            {/* Email */}
                            <div className="flex items-center group">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4 shrink-0" style={{ backgroundColor: 'rgba(255, 121, 5, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="material-icons text-2xl" style={{ color: '#FF7905' }}>alternate_email</span>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-wider font-bold" style={{ color: '#94a3b8' }}>Email Address</p>
                                    <p className="font-bold break-all text-base" style={{ color: '#1e293b' }}>{profile.email}</p>
                                </div>
                            </div>

                            {/* Phone */}
                            <div className="flex items-center group">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4 shrink-0" style={{ backgroundColor: 'rgba(255, 121, 5, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="material-icons text-2xl" style={{ color: '#FF7905' }}>call</span>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-wider font-bold" style={{ color: '#94a3b8' }}>Phone Number</p>
                                    <p className="font-bold text-base" style={{ color: '#1e293b' }}>{profile.phoneNumber || "+91 9833911446"}</p>
                                </div>
                            </div>

                            {/* DOB */}
                            <div className="flex items-center group">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4 shrink-0" style={{ backgroundColor: 'rgba(255, 121, 5, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="material-icons text-2xl" style={{ color: '#FF7905' }}>cake</span>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-wider font-bold" style={{ color: '#94a3b8' }}>Date of Birth</p>
                                    <p className="font-bold text-base" style={{ color: '#1e293b' }}>
                                        {formatDate(profile.dob)}
                                    </p>
                                </div>
                            </div>

                            {/* Blood Group */}
                            <div className="flex items-center group">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4 shrink-0" style={{ backgroundColor: 'rgba(255, 121, 5, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="material-icons text-2xl" style={{ color: '#FF7905' }}>water_drop</span>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-wider font-bold" style={{ color: '#94a3b8' }}>Blood Group</p>
                                    <p className="font-bold text-base" style={{ color: '#1e293b' }}>{profile.bloodGroup || "'O' Positive"}</p>
                                </div>
                            </div>
                        </div>

                        {/* QR Code Section */}
                        <div className="flex flex-col items-center justify-center mb-5 mt-auto">
                            <div className="relative p-3 rounded-2xl shadow-sm" style={{ backgroundColor: '#ffffff', borderColor: '#f1f5f9', borderWidth: '1px' }}>
                                <div className="w-48 h-48 flex items-center justify-center relative rounded-lg overflow-hidden" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderWidth: '1px' }}>
                                    <QRCodeCanvas
                                        value={`https://vigtask.vercel.app/dashboard/users/${profile.id}/profile`}
                                        size={170}
                                        bgColor={"transparent"}
                                        fgColor={"#1e293b"}
                                        level={"H"}
                                    />
                                    {/* Center Logo */}
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="p-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.95)' }}>
                                            <img
                                                src="https://admissionuploads.s3.ap-south-1.amazonaws.com//1769512650123_VLogo.png"
                                                alt="Logo"
                                                className="w-10 h-10 object-contain"
                                                crossOrigin="anonymous"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Address Footer */}
                    <div className="px-8 py-5 text-center relative z-20" style={{ backgroundColor: '#FF7905' }}>
                        <p className="text-[15px] font-bold leading-relaxed" style={{ color: '#000000' }}>
                            90 Feet Rd, Thakur Complex, Kandivali East,<br />
                            Mumbai - 400101, Maharashtra.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
