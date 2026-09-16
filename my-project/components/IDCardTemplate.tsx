import { getProxiedImageUrl } from '@/lib/imageProxy';
import { removeBackground } from "@imgly/background-removal";
import { Briefcase, Calendar, Droplets, Mail, Phone, ShieldAlert } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import React, { useEffect, useState } from 'react';

// TODO: Replace with the actual UUID for Vighnesh Inc
const VIGHNESH_INC_ORG_ID = "db48c76a-a587-4538-8a16-40577a0d7406";
const YOUTUBE_ORG_ID = "196099a1-be3d-4bbf-b0d5-2a5fb8d540f9";

interface Profile {
    id?: string;
    firstName?: string;
    lastName?: string;
    position?: string;
    image?: string;
    phoneNumber?: string;
    email?: string;
    bloodGroup?: string;
    emergencyContact?: string;
    dob?: string;
    joiningDate?: string;
    organizationId?: string;
}

interface IDCardTemplateProps {
    profile: Profile;
    idCardRef: React.RefObject<HTMLDivElement>;
    onImageProcessed?: () => void;
    processedImage?: string | null;
    shouldProcess?: boolean;
    organizationId?: string;
}

export const IDCardTemplate = ({ profile, idCardRef, onImageProcessed, processedImage: externalProcessedImage, shouldProcess = false, organizationId }: IDCardTemplateProps) => {
    const [internalProcessedImage, setInternalProcessedImage] = useState<string | null>(null);

    const displayImage = externalProcessedImage || internalProcessedImage || profile.image;

    useEffect(() => {
        if (!shouldProcess) {
            if (onImageProcessed) onImageProcessed();
            return;
        }

        let isMounted = true;
        const processImage = async () => {
            if (profile.image && profile.image.startsWith('blob:')) {
                if (isMounted) {
                    setInternalProcessedImage(profile.image);
                    onImageProcessed?.();
                }
                return;
            }

            if (!profile.image) {
                if (isMounted) {
                    setInternalProcessedImage(null);
                    onImageProcessed?.();
                }
                return;
            }

            try {
                const imageBlob = await removeBackground(profile.image);
                const url = URL.createObjectURL(imageBlob);
                if (isMounted) {
                    setInternalProcessedImage(url);
                    onImageProcessed?.();
                }
            } catch (error) {
                console.error("Failed to remove background", error);
                if (isMounted) {
                    setInternalProcessedImage(profile.image);
                    onImageProcessed?.();
                }
            }
        };

        processImage();
        return () => { isMounted = false; };
    }, [profile.id, profile.image, shouldProcess]);

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return "25 August 2003";
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

    const currentOrgId = profile.organizationId || (profile as any).organiationId || organizationId;
    const isVighneshInc = currentOrgId === VIGHNESH_INC_ORG_ID;
    const isYoutube = currentOrgId === YOUTUBE_ORG_ID;

    if (isYoutube) {
        return (
            <div ref={idCardRef} style={{ background: 'transparent', padding: '0', margin: '0', boxSizing: 'border-box' }}>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Chivo:ital,wght@0,100..900;1,100..900&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
                    rel="stylesheet"
                />

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
                        <div style={{ padding: '28px' }}>
                            <div style={{ padding: '0 42px', margin: '10px 0 26px 0' }}>
                                <img
                                    src={getProxiedImageUrl("https://admissionuploads.s3.ap-south-1.amazonaws.com/1789544541386_front-logo.png")}
                                    alt="logo"
                                    style={{ width: '100%', objectFit: 'cover' }}
                                    crossOrigin="anonymous"
                                />
                            </div>

                            <div style={{ fontFamily: "'Chivo', sans-serif", marginTop: '16px', fontSize: '20px', color: '#000' }}>
                                {profile.position || "Graphic Designer"}
                            </div>

                            <div style={{ fontFamily: "'Poppins', sans-serif", marginTop: '10px', fontSize: '42px', fontWeight: 900, lineHeight: 1.1, color: '#000' }}>
                                {(profile.firstName || "HIMANSHU").toUpperCase()}<br />
                                {(profile.lastName || "JANGID").toUpperCase()}
                            </div>

                            <div style={{ fontFamily: "'Chivo', sans-serif", marginTop: '10px', fontSize: '16px', color: '#000' }}>
                                EMP ID: {profile.id?.slice(0, 4).toUpperCase() || "0001"}
                            </div>
                        </div>

                        <div style={{
                            position: 'absolute',
                            bottom: '0',
                            left: '0',
                            right: '0',
                            height: '280px',
                            zIndex: 2,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'flex-end',
                        }}>
                            <img
                                src={getProxiedImageUrl(displayImage || "")}
                                alt="Profile"
                                style={{ maxWidth: '100%', maxHeight: '100%' }}
                                crossOrigin="anonymous"
                            />
                        </div>

                        <div style={{ width: '100%', position: 'absolute', bottom: '-4px', left: '0', right: '0', zIndex: 1 }}>
                            <img
                                src={getProxiedImageUrl("https://admissionuploads.s3.ap-south-1.amazonaws.com/1789466609111_front-bg.png")}
                                alt=""
                                style={{ width: '100%', objectFit: 'cover' }}
                                crossOrigin="anonymous"
                            />
                        </div>
                    </div>

                    {/* ================= BACK SIDE ================= */}
                    <div style={{ backgroundColor: '#ff0000', borderRadius: '16px' }}>
                        <div style={{
                            width: '400px',
                            height: '620px',
                            borderRadius: '16px',
                            overflow: 'hidden',
                            boxShadow: '0 12px 25px rgba(0, 0, 0, 0.15)',
                            position: 'relative',
                            backgroundImage: `url(${getProxiedImageUrl('https://admissionuploads.s3.ap-south-1.amazonaws.com/1789461224179_back-bg.png')})`,
                            backgroundPosition: 'center',
                            backgroundSize: 'cover',
                            backgroundRepeat: 'no-repeat',
                        }}>
                            <div style={{
                                fontFamily: "'Montserrat', sans-serif",
                                position: 'absolute',
                                top: '55px',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                fontSize: '110px',
                                fontWeight: 700,
                                color: '#fff',
                                lineHeight: 1,
                                letterSpacing: '-0.05em',
                                textAlign: 'center',
                                zIndex: 1,
                            }}>
                                {(profile.position?.split(' ')[0] || "Creative")}<br />
                                Division
                            </div>

                            <div style={{ padding: '220px 24px 0', fontSize: '15px', color: '#fff', fontFamily: "'Poppins', sans-serif", position: 'relative', zIndex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', height: '40px' }}>
                                    <div style={{ width: '26px', height: '26px', backgroundColor: '#fff', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Phone size={14} color="#ff0000" fill="#ff0000" />
                                    </div>
                                    <p style={{ margin: 0 }}>{profile.phoneNumber || "+91 95944 94737"}</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', height: '40px' }}>
                                    <div style={{ width: '26px', height: '26px', backgroundColor: '#fff', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Mail size={14} color="#ff0000" fill="#ff0000" />
                                    </div>
                                    <p style={{ margin: 0 }}>{profile.email || "himanshu@gmail.com"}</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', height: '40px' }}>
                                    <div style={{ width: '26px', height: '26px', backgroundColor: '#fff', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Droplets size={14} color="#ff0000" fill="#ff0000" />
                                    </div>
                                    <p style={{ margin: 0 }}>{profile.bloodGroup || "O Positive"}</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', height: '40px' }}>
                                    <div style={{ width: '26px', height: '26px', backgroundColor: '#fff', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Calendar size={14} color="#ff0000" fill="#ff0000" />
                                    </div>
                                    <p style={{ margin: 0 }}>{formatDate(profile.dob)}</p>
                                </div>
                            </div>

                            <div style={{
                                position: 'absolute',
                                bottom: '30px',
                                left: '24px',
                                width: '100px',
                                height: '100px',
                                background: '#ffffff',
                                padding: '6px',
                                zIndex: 1,
                            }}>
                                <QRCodeCanvas
                                    value={`https://linktr.ee/vighnotech`}
                                    size={88}
                                    bgColor={"#ffffff"}
                                    fgColor={"#000000"}
                                    level={"H"}
                                    style={{ width: '100%', height: '100%' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (isVighneshInc) {
        return (
            <div ref={idCardRef} style={{ background: 'transparent', padding: '0', margin: '0', boxSizing: 'border-box' }}>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Chivo:ital,wght@0,100..900;1,100..900&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
                    rel="stylesheet"
                />

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
                        <div style={{ padding: '28px' }}>
                            <div style={{ padding: '0 42px', margin: '10px 0 26px 0' }}>
                                <img
                                    src={getProxiedImageUrl("https://admissionuploads.s3.ap-south-1.amazonaws.com/1789460853502_front-logo.png")}
                                    alt="logo"
                                    style={{ width: '100%', objectFit: 'cover' }}
                                    crossOrigin="anonymous"
                                />
                            </div>

                            <div style={{ fontFamily: "'Chivo', sans-serif", marginTop: '16px', fontSize: '20px', color: '#000' }}>
                                {profile.position || "Graphic Designer"}
                            </div>

                            <div style={{ fontFamily: "'Poppins', sans-serif", marginTop: '10px', fontSize: '42px', fontWeight: 900, lineHeight: 1.1, color: '#000' }}>
                                {(profile.firstName || "HIMANSHU").toUpperCase()}<br />
                                {(profile.lastName || "JANGID").toUpperCase()}
                            </div>

                            <div style={{ fontFamily: "'Chivo', sans-serif", marginTop: '10px', fontSize: '16px', color: '#000' }}>
                                EMP ID: {profile.id?.slice(0, 4).toUpperCase() || "0001"}
                            </div>
                        </div>

                        <div style={{
                            position: 'absolute',
                            bottom: '0',
                            left: '0',
                            right: '0',
                            height: '280px',
                            zIndex: 2,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'flex-end',
                        }}>
                            <img
                                src={getProxiedImageUrl(displayImage || "")}
                                alt="Profile"
                                style={{ maxWidth: '100%', maxHeight: '100%' }}
                                crossOrigin="anonymous"
                            />
                        </div>

                        <div style={{ width: '100%', position: 'absolute', bottom: '-4px', left: '0', right: '0', zIndex: 1 }}>
                            <img
                                src={getProxiedImageUrl("https://admissionuploads.s3.ap-south-1.amazonaws.com/1789544409148_front.png")}
                                alt=""
                                style={{ width: '100%', objectFit: 'cover' }}
                                crossOrigin="anonymous"
                            />
                        </div>
                    </div>

                    {/* ================= BACK SIDE ================= */}
                    <div style={{ backgroundColor: '#004aad', borderRadius: '16px' }}>
                        <div style={{
                            width: '400px',
                            height: '620px',
                            borderRadius: '16px',
                            overflow: 'hidden',
                            boxShadow: '0 12px 25px rgba(0, 0, 0, 0.15)',
                            position: 'relative',
                            backgroundImage: `url(${getProxiedImageUrl('https://admissionuploads.s3.ap-south-1.amazonaws.com/1789461224179_back-bg.png')})`,
                            backgroundPosition: 'center',
                            backgroundSize: 'cover',
                            backgroundRepeat: 'no-repeat',
                        }}>
                            <div style={{
                                fontFamily: "'Montserrat', sans-serif",
                                position: 'absolute',
                                top: '55px',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                fontSize: '110px',
                                fontWeight: 700,
                                color: '#fff',
                                lineHeight: 1,
                                letterSpacing: '-0.05em',
                                textAlign: 'center',
                                zIndex: 1,
                            }}>
                                {(profile.position?.split(' ')[0] || "Creative")}<br />
                                Division
                            </div>

                            <div style={{ padding: '220px 24px 0', fontSize: '15px', color: '#fff', fontFamily: "'Poppins', sans-serif", position: 'relative', zIndex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', height: '40px' }}>
                                    <div style={{ width: '26px', height: '26px', backgroundColor: '#fff', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Phone size={14} color="#004aad" fill="#004aad" />
                                    </div>
                                    <p style={{ margin: 0 }}>{profile.phoneNumber || "+91 95944 94737"}</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', height: '40px' }}>
                                    <div style={{ width: '26px', height: '26px', backgroundColor: '#fff', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Mail size={14} color="#004aad" fill="#004aad" />
                                    </div>
                                    <p style={{ margin: 0 }}>{profile.email || "himanshu@gmail.com"}</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', height: '40px' }}>
                                    <div style={{ width: '26px', height: '26px', backgroundColor: '#fff', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Droplets size={14} color="#004aad" fill="#004aad" />
                                    </div>
                                    <p style={{ margin: 0 }}>{profile.bloodGroup || "O Positive"}</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', height: '40px' }}>
                                    <div style={{ width: '26px', height: '26px', backgroundColor: '#fff', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Calendar size={14} color="#004aad" fill="#004aad" />
                                    </div>
                                    <p style={{ margin: 0 }}>{formatDate(profile.dob)}</p>
                                </div>
                            </div>

                            <div style={{
                                position: 'absolute',
                                bottom: '30px',
                                left: '24px',
                                width: '100px',
                                height: '100px',
                                background: '#ffffff',
                                padding: '6px',
                                zIndex: 1,
                            }}>
                                <QRCodeCanvas
                                    value={`https://linktr.ee/vighnotech`}
                                    size={88}
                                    bgColor={"#ffffff"}
                                    fgColor={"#000000"}
                                    level={"H"}
                                    style={{ width: '100%', height: '100%' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

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
                    <div style={{ padding: '160px 48px 0', marginTop: '24px', fontSize: '15px', color: '#fff', fontFamily: "'Poppins', sans-serif", position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}>
                            <div style={{
                                width: '30px',
                                height: '30px',
                                backgroundColor: '#fff',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                transform: 'translateY(6px)'
                            }}>
                                <Phone size={15} color="#fb923c" strokeWidth={3} />
                            </div>
                            <p style={{ margin: 0, fontWeight: 500 }}>{profile.phoneNumber || "+91 95944 94737"}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}>
                            <div style={{
                                width: '30px',
                                height: '30px',
                                backgroundColor: '#fff',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                transform: 'translateY(6px)'
                            }}>
                                <Mail size={15} color="#fb923c" strokeWidth={3} />
                            </div>
                            <p style={{ margin: 0, fontWeight: 500 }}>{profile.email || ""}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}>
                            <div style={{
                                width: '30px',
                                height: '30px',
                                backgroundColor: '#fff',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                transform: 'translateY(6px)'
                            }}>
                                <Droplets size={15} color="#fb923c" strokeWidth={3} />
                            </div>
                            <p style={{ margin: 0, fontWeight: 500 }}>Blood Group: {profile.bloodGroup || "O Positive"}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}>
                            <div style={{
                                width: '30px',
                                height: '30px',
                                backgroundColor: '#fff',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                transform: 'translateY(6px)'
                            }}>
                                <ShieldAlert size={15} color="#fb923c" strokeWidth={3} />
                            </div>
                            <p style={{ margin: 0, fontWeight: 500 }}>Emergency: {profile.emergencyContact || "+91 00000 00000"}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}>
                            <div style={{
                                width: '30px',
                                height: '30px',
                                backgroundColor: '#fff',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                transform: 'translateY(6px)'
                            }}>
                                <Calendar size={15} color="#fb923c" strokeWidth={3} />
                            </div>
                            <p style={{ margin: 0, fontWeight: 500 }}>DOB: {formatDate(profile.dob)}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}>
                            <div style={{
                                width: '30px',
                                height: '30px',
                                backgroundColor: '#fff',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                transform: 'translateY(6px)'
                            }}>
                                <Briefcase size={15} color="#fb923c" strokeWidth={3} />
                            </div>
                            <p style={{ margin: 0, fontWeight: 500 }}>DOJ: {formatDate(profile.joiningDate)}</p>
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
                                value="https://linktr.ee/vighnotech"
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
