import React, { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { removeBackground } from "@imgly/background-removal";
import { getProxiedImageUrl } from '@/lib/imageProxy';

interface IDCardTemplateProps {
    profile: any;
    idCardRef: React.RefObject<HTMLDivElement | null>;
    onImageProcessed?: () => void;
    processedImage?: string | null;
    shouldProcess?: boolean;
}

export const IDCardTemplate = ({ profile, idCardRef, onImageProcessed, processedImage: externalProcessedImage, shouldProcess = false }: IDCardTemplateProps) => {
    const [internalProcessedImage, setInternalProcessedImage] = useState<string | null>(null);

    const displayImage = externalProcessedImage || internalProcessedImage || profile.image;

    useEffect(() => {
        if (!shouldProcess) {
            if (onImageProcessed) onImageProcessed();
            return;
        }

        let isMounted = true;
        const processImage = async () => {
            // If we already have a blob url that we generated, don't re-process
            if (profile.image?.startsWith('blob:')) {
                if (isMounted) {
                    setInternalProcessedImage(profile.image);
                    onImageProcessed?.();
                }
                return;
            }

            if (!profile.image) {
                if (isMounted) {
                    setInternalProcessedImage(null); // Use fallback
                    onImageProcessed?.();
                }
                return;
            }

            try {
                const imageBlob = await removeBackground(profile.image);
                const url = URL.createObjectURL(imageBlob);
                if (isMounted) {
                    setInternalProcessedImage(url);
                    console.log("Background removed for", profile.firstName);
                    onImageProcessed?.();
                }
            } catch (error) {
                console.error("Failed to remove background", error);
                if (isMounted) {
                    setInternalProcessedImage(profile.image); // Fallback to original
                    onImageProcessed?.();
                }
            }
        };

        processImage();
        return () => { isMounted = false; };
    }, [profile.id, profile.image, shouldProcess]); // Dependency on profile.id to ensure re-process if user changes but image URL is same (unlikely but safe)

    // Format date properly
    const formatDate = (dateString: string) => {
        if (!dateString) return "25 August 2003"; // Default label from user template
        try {
            return new Date(dateString).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        } catch {
            return "25 August 2003";
        }
    };

    return (
        <div ref={idCardRef} style={{ background: 'transparent', padding: '0', margin: '0', boxSizing: 'border-box' }}>
            {/* External Resources */}
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link
                href="https://fonts.googleapis.com/css2?family=Chivo:ital,wght@0,100..900;1,100..900&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
                rel="stylesheet"
            />

            {/* MAIN WRAPPER */}
            <div style={{
                display: 'flex',
                gap: '40px',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '40px',
            }}>
                {/* ================= FRONT SIDE ================= */}
                <div style={{
                    width: '400px',
                    height: '620px',
                    background: '#ffffff',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 12px 25px rgba(0, 0, 0, 0.15)',
                    position: 'relative',
                }}>
                    {/* Header */}
                    <div style={{ padding: '28px' }}>
                        <div style={{ padding: '0 42px', margin: '10px 0 14px 0' }}>
                            <img
                                src={getProxiedImageUrl("https://admissionuploads.s3.ap-south-1.amazonaws.com//1769776403335_Vighno%20ID%20(1).png")}
                                alt="logo"
                                style={{ width: '100%', objectFit: 'cover' }}
                                crossOrigin="anonymous"
                            />
                        </div>
                        <div style={{ fontFamily: "'Chivo', sans-serif", fontSize: '20px', color: '#000' }}>
                            {profile.position || ""}
                        </div>

                        <div style={{ fontFamily: "'Poppins', sans-serif", margin: '0px 0 12px', fontSize: '48px', fontWeight: 900, lineHeight: 1, color: '#000' }}>
                            {(profile.firstName || "").toUpperCase()}<br />
                            {(profile.lastName || "").toUpperCase()}
                        </div>

                        <div style={{ fontFamily: "'Chivo', sans-serif", marginTop: '10px', fontSize: '16px', color: '#000' }}>
                            EMP ID: {profile.id?.slice(0, 4).toUpperCase() || ""}
                        </div>
                    </div>

                    {/* Profile Image */}
                    <div style={{
                        position: 'absolute',
                        bottom: '0',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '100%',
                        height: '415px',
                        zIndex: 1,
                    }}>
                        <img
                            src={getProxiedImageUrl(displayImage || "")}
                            alt="Profile"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            crossOrigin="anonymous"
                        />
                    </div>

                    {/* Decorative Bottom */}
                    <div style={{ width: '100%', position: 'absolute', bottom: '-4px', left: '0', right: '0' }}>
                        <img
                            src={getProxiedImageUrl("https://admissionuploads.s3.ap-south-1.amazonaws.com//1769778312732_Vighno%20ID.png")}
                            alt=""
                            style={{ width: '100%', objectFit: 'cover' }}
                            crossOrigin="anonymous"
                        />
                    </div>
                </div>

                {/* ================= BACK SIDE ================= */}
                <div style={{
                    width: '400px',
                    height: '620px',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 12px 25px rgba(0, 0, 0, 0.15)',
                    position: 'relative',
                    backgroundColor: '#fb923c',
                }}>
                    {/* Background Image */}
                    <img
                        src={getProxiedImageUrl("https://admissionuploads.s3.ap-south-1.amazonaws.com//1769779682030_back.jpg.jpeg")}
                        alt=""
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
                        crossOrigin="anonymous"
                    />

                    {/* Title */}
                    <div style={{
                        fontFamily: "'Montserrat', sans-serif",
                        position: 'absolute',
                        top: '44px',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: '105px',
                        fontWeight: 700,
                        color: '#000',
                        lineHeight: 1,
                        zIndex: 1,
                        textAlign: 'center',
                    }}>
                        {(profile.position?.split(' ')[0] || "")}<br />
                        Division
                    </div>

                    {/* Info */}
                    <div style={{ padding: '220px 24px 0', fontSize: '15px', color: '#fff', fontFamily: "'Poppins', sans-serif", position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', height: '50px' }}>
                            <div style={{ width: '30px', height: '30px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translateY(8px)' }}>
                                <img
                                    src={getProxiedImageUrl("https://admissionuploads.s3.ap-south-1.amazonaws.com//1769780545994_back.png")}
                                    alt=""
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                    crossOrigin="anonymous"
                                />
                            </div>
                            <p style={{ margin: 0 }}>{profile.phoneNumber || "+91 95944 94737"}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', height: '50px' }}>
                            <div style={{ width: '30px', height: '30px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translateY(8px)' }}>
                                <img
                                    src={getProxiedImageUrl("https://admissionuploads.s3.ap-south-1.amazonaws.com//1769781185497_back%20(1).png")}
                                    alt=""
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                    crossOrigin="anonymous"
                                />
                            </div>
                            <p style={{ margin: 0 }}>{profile.email || ""}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', height: '50px' }}>
                            <div style={{ width: '30px', height: '30px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translateY(8px)' }}>
                                <img
                                    src={getProxiedImageUrl("https://admissionuploads.s3.ap-south-1.amazonaws.com//1769781289822_back%20(2).png")}
                                    alt=""
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                    crossOrigin="anonymous"
                                />
                            </div>
                            <p style={{ margin: 0 }}>{profile.bloodGroup || "O Positive"}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', height: '50px' }}>
                            <div style={{ width: '30px', height: '30px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translateY(8px)' }}>
                                <img
                                    src={getProxiedImageUrl("https://admissionuploads.s3.ap-south-1.amazonaws.com//1769781382352_back%20(3).png")}
                                    alt=""
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                    crossOrigin="anonymous"
                                />
                            </div>
                            <p style={{ margin: 0 }}>{formatDate(profile.dob)}</p>
                        </div>
                    </div>

                    {/* QR Code & Address */}
                    <div style={{
                        position: 'absolute',
                        bottom: '24px',
                        left: '24px',
                        right: '24px',
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: '16px',
                        zIndex: 1,
                    }}>
                        <div style={{
                            width: '120px',
                            height: '115px',
                            background: '#ffffff',
                            padding: '8px',
                            borderRadius: '8px',
                        }}>
                            <QRCodeCanvas
                                value={`https://vigtask.vercel.app/dashboard/users/${profile.id}/profile`}
                                size={104}
                                bgColor={"#ffffff"}
                                fgColor={"#000000"}
                                level={"H"}
                            />
                        </div>
                        <div style={{
                            flex: 1,
                            fontSize: '12px',
                            color: '#fff',
                            fontWeight: 500,
                            lineHeight: 1.4,
                            marginBottom: '4px',
                        }}>
                            90 feet road, Thakur Complex,<br />
                            Kandivali(E), Mumbai: 400101
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
