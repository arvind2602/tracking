'use client';

import Link from "next/link";
import { usePathname, useRouter } from 'next/navigation';
import { Home, Code, GraduationCap, LogOut, Menu, X, Clock, MapPin, QrCode, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { jwtDecode } from 'jwt-decode';
import { ModeToggle } from "@/components/mode-toggle";
import { QrReader } from "react-qr-reader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import axios from "@/lib/axios";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

// Interface for video element ref
interface QrReaderElement extends HTMLDivElement {
  querySelector: (selector: string) => HTMLVideoElement | null;
}

interface DecodedToken {
  user: {
    role: string;
  };
}

let userRole: string | null = null;
const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
if (token) {
  try {
    const payload: DecodedToken = jwtDecode(token);
    userRole = payload.user.role;
  } catch (error) {
    console.error('Invalid token', error);
  }
}

function useIsSecureContext() {
  const [isSecure, setIsSecure] = useState(true);
  useEffect(() => {
    setIsSecure(window.isSecureContext);
  }, []);
  return isSecure;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const qrReaderRef = useRef<HTMLDivElement>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [scannedData, setScannedData] = useState<{
    siteId: string;
    siteName: string;
    lat: number;
    lng: number;
    token: string;
  } | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<"LOADING" | "CHECKED_IN" | "CHECKED_OUT">("LOADING");
  const [isProcessing, setIsProcessing] = useState(false);

  // Checkout form state (mini version for modal)
  const [checkoutType, setCheckoutType] = useState("HOME");
  const [checkoutReason, setCheckoutReason] = useState("");

  const isSecure = useIsSecureContext();
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Cleanup camera when modal closes
  useEffect(() => {
    if (!showQrScanner) {
      // Stop all video tracks when QR scanner closes
      const stopCamera = () => {
        if (qrReaderRef.current) {
          const video = qrReaderRef.current.querySelector('video');
          if (video && video.srcObject) {
            const stream = video.srcObject as MediaStream;
            stream.getTracks().forEach(track => {
              track.stop();
            });
            video.srcObject = null;
          }
        }
      };

      // Small delay to ensure the component has rendered
      const timer = setTimeout(stopCamera, 100);
      return () => clearTimeout(timer);
    }
  }, [showQrScanner]);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('token')) {
      checkStatus();
    }
  }, []);

  useEffect(() => {
    if (showQrScanner && !isSecure) {
      setCameraError("Insecure Connection: Camera access is disabled on non-HTTPS connections. Please use a secure URL.");
    } else if (showQrScanner && (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)) {
      setCameraError("Camera API not supported or blocked by browser settings.");
    } else {
      setCameraError(null);
    }
  }, [showQrScanner, isSecure]);

  const checkStatus = async () => {
    try {
      const res = await axios.get("/attendance/history?scope=personal");
      if (res.data.length > 0 && !res.data[0].checkOut) {
        setAttendanceStatus("CHECKED_IN");
      } else {
        setAttendanceStatus("CHECKED_OUT");
      }
    } catch (err) {
      console.error(err);
      setAttendanceStatus("CHECKED_OUT");
    }
  };

  // Function to properly close QR scanner and stop camera
  const closeQrScanner = () => {
    // Stop camera before closing
    if (qrReaderRef.current) {
      const video = qrReaderRef.current.querySelector('video');
      if (video && video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          track.stop();
        });
        video.srcObject = null;
      }
    }
    setShowQrScanner(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  const processDirectScan = async (scannedText: string) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            let deviceId = localStorage.getItem("attendance_device_id");
            if (!deviceId) {
              deviceId = crypto.randomUUID();
              localStorage.setItem("attendance_device_id", deviceId);
            }

            const res = await axios.post("/attendance/checkin", {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              deviceId: deviceId,
              deviceType: navigator.userAgent
            });

            if (res.data.alert) {
              toast.success(`Checked in! Warning: ${res.data.alert}`);
            } else {
              toast.success("Checked in successfully!");
            }
            checkStatus();
          } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to check in.");
          }
        },
        (error) => {
          toast.error("Location required for check-in.");
        }
      );
    } else {
      toast.error("Geolocation not supported.");
    }
  };

  const handleScan = async (result: any, error: any) => {
    if (result) {
      const scannedText = typeof result === 'string' ? result : result?.text;
      if (!scannedText) return;

      closeQrScanner();

      // Check if it looks like a JWT (Site QR)
      if (scannedText.startsWith('ey')) {
        try {
          const decoded: any = jwtDecode(scannedText);
          if (decoded.type === 'SITE_QR') {
            setScannedData({
              siteId: decoded.siteId,
              siteName: decoded.siteName,
              lat: decoded.lat,
              lng: decoded.lng,
              token: scannedText
            });
            setShowActionModal(true);
            return;
          }
        } catch (e) {
          console.error("Failed to decode site QR", e);
        }
      }

      // If not a site QR or failed to decode, fallback to direct check-in
      processDirectScan(scannedText);
    }
  };

  const handleSiteCheckIn = async () => {
    if (!scannedData) return;
    setIsProcessing(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            let deviceId = localStorage.getItem("attendance_device_id");
            if (!deviceId) {
              deviceId = crypto.randomUUID();
              localStorage.setItem("attendance_device_id", deviceId);
            }

            const res = await axios.post("/attendance/scan", {
              qrToken: scannedData.token,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              deviceId: deviceId,
              deviceType: navigator.userAgent,
              activityType: 'WORK'
            });

            toast.success(res.data.message || `Checked in at ${scannedData.siteName}`);
            setShowActionModal(false);
            setScannedData(null);
            checkStatus();
          } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to check in.");
          } finally {
            setIsProcessing(false);
          }
        },
        (err) => {
          toast.error("Location required for check-in.");
          setIsProcessing(false);
        }
      );
    } else {
      toast.error("Geolocation not supported.");
      setIsProcessing(false);
    }
  };

  const handleSiteCheckOut = async () => {
    if (!scannedData) return;
    setIsProcessing(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            await axios.post("/attendance/checkout", {
              reason: checkoutReason || `Checked out at ${scannedData.siteName}`,
              type: checkoutType,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude
            });

            toast.success("Checked out successfully!");
            setShowActionModal(false);
            setScannedData(null);
            setCheckoutReason("");
            setCheckoutType("HOME");
            checkStatus();
          } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to check out.");
          } finally {
            setIsProcessing(false);
          }
        },
        (err) => {
          toast.error("Location could not be verified, trying checkout anyway...");
          performSimpleCheckOut();
        }
      );
    } else {
      performSimpleCheckOut();
    }
  };

  const performSimpleCheckOut = async () => {
    try {
      await axios.post("/attendance/checkout", {
        reason: checkoutReason || `Checked out at site (location missing)`,
        type: checkoutType
      });
      toast.success("Checked out successfully!");
      setShowActionModal(false);
      setScannedData(null);
      setCheckoutReason("");
      setCheckoutType("HOME");
      checkStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to check out.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!userRole && typeof window !== 'undefined') {
    router.push('/');
  }

  const allNavItems = [
    { href: '/dashboard', icon: Home, label: 'Dashboard' },
    { href: '/dashboard/tasks', icon: Code, label: 'Tasks' },
    { href: '/dashboard/attendance', icon: Clock, label: 'Attendance' },
    { href: '/dashboard/sites', icon: MapPin, label: 'Sites' },
    { href: '/dashboard/users', icon: GraduationCap, label: 'Users' },
    { href: '/dashboard/projects', icon: Code, label: 'Projects' },
  ];

  const navItems = userRole === 'USER'
    ? allNavItems.filter(item => item.label === 'Tasks' || item.label === 'Attendance')
    : allNavItems;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setIsSidebarOpen(false);
      }
    };

    if (isSidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen]);

  return (
    <div className="flex h-screen bg-background text-foreground font-sans">
      <aside
        ref={sidebarRef}
        className={`fixed top-0 left-0 z-40 w-64 h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="p-6 border-b border-sidebar-border flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center justify-center text-xl font-bold tracking-tight">
            Vighnotech
          </Link>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground">
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-2">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-medium text-sidebar-foreground/70">Theme</span>
            <ModeToggle />
          </div>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 bg-transparent border-sidebar-border text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
            onClick={() => setShowQrScanner(true)}
          >
            <QrCode className="h-4 w-4" />
            Scan QR
          </Button>

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        <header className="md:hidden flex items-center justify-between p-4 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
          <button onClick={() => setIsSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <button onClick={() => setShowQrScanner(true)} className="md:hidden">
            <QrCode className="h-6 w-6" />
          </button>
          <Link href="/dashboard" className="text-lg font-bold">
            Vighnotech
          </Link>
        </header>
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>

      <Dialog open={showActionModal} onOpenChange={setShowActionModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Site Action Found</DialogTitle>
            <DialogDescription>
              You scanned <strong>{scannedData?.siteName}</strong>. Select your action below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                className="w-full text-lg h-16 gap-2"
                disabled={isProcessing || attendanceStatus === "CHECKED_IN"}
                onClick={handleSiteCheckIn}
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : <Clock className="h-5 w-5" />}
                Check In at {scannedData?.siteName}
              </Button>
              {attendanceStatus === "CHECKED_IN" && (
                <p className="text-xs text-amber-600 text-center italic">
                  You are already checked in.
                </p>
              )}
            </div>

            <div className="relative mt-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">OR</span>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Type</label>
                  <Select onValueChange={setCheckoutType} value={checkoutType}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LUNCH">Lunch</SelectItem>
                      <SelectItem value="BREAK">Break</SelectItem>
                      <SelectItem value="HOME">Go Home</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Note (Optional)</label>
                  <Input
                    placeholder="Brief reason..."
                    className="h-9"
                    value={checkoutReason}
                    onChange={(e) => setCheckoutReason(e.target.value)}
                  />
                </div>
              </div>

              <Button
                variant="destructive"
                size="lg"
                className="w-full text-lg h-16 gap-2"
                disabled={isProcessing || attendanceStatus === "CHECKED_OUT"}
                onClick={handleSiteCheckOut}
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : <LogOut className="h-5 w-5" />}
                Check Out / Break
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setShowActionModal(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showQrScanner} onOpenChange={(open) => {
        if (!open) closeQrScanner();
        else setShowQrScanner(true);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan Office QR Code</DialogTitle>
            <DialogDescription>
              Point your camera at the QR code on the office door.
            </DialogDescription>
          </DialogHeader>
          <div
            ref={qrReaderRef}
            className="w-full aspect-square bg-slate-950 rounded-lg overflow-hidden relative border-2 border-slate-800 flex items-center justify-center"
          >
            {cameraError ? (
              <div className="p-6 text-center space-y-3">
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                  <X className="text-red-500 h-6 w-6" />
                </div>
                <p className="text-sm text-red-400 font-medium">{cameraError}</p>
                <div className="text-[10px] text-slate-500 space-y-1">
                  <p>1. Ensure your URL starts with <strong>https://</strong></p>
                  <p>2. Try using VS Code Port Forwarding (Recommended)</p>
                </div>
              </div>
            ) : (
              <>
                <QrReader
                  onResult={handleScan}
                  constraints={{ facingMode: 'environment' }}
                  videoStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  containerStyle={{ width: '100%', height: '100%' }}
                  videoId="qr-video-element"
                />
                <div className="absolute inset-0 pointer-events-none border-[40px] border-black/20 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-white/50 rounded-lg"></div>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <p className="text-[10px] text-muted-foreground text-center mb-2 sm:mb-0">
              Note: Camera requires <strong>HTTPS</strong> or <strong>localhost</strong> to work on mobile.
            </p>
            <Button variant="outline" onClick={closeQrScanner}>Close Scanner</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}