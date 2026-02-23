'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from '@/lib/axios';
import { jwtDecode } from 'jwt-decode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Plus, Search, Download, Edit, Trash2, FileUp, Users, BarChart2,
  Settings, X, Filter, ChevronRight, Activity, Calendar, Mail, User, Briefcase,
  CheckCircle2, Clock, AlertCircle, FilePlus, Eye, Layout
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Breadcrumbs from "@/components/ui/breadcrumbs";

interface DecodedToken {
  user: {
    role: string;
    is_hr: boolean;
  };
}

interface DocumentTemplate {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
  createdAt: string;
  content: string;
}

interface GeneratedDocument {
  id: string;
  templateId: string;
  employeeId: string;
  type: string;
  status: string;
  generatedAt: string;
  notes: string;
  fileUrl: string;
  employeeFirstName: string;
  employeeLastName: string;
  templateName: string;
  generatedByFirstName: string;
  generatedByLastName: string;
  content: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  image?: string;
  role: string;
}

interface PerformanceStats {
  totalDocuments: number;
  generatedCount: number;
  sentCount: number;
  signedCount: number;
}

export default function HRDashboard() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isHR, setIsHR] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Document Templates State
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateTypeFilter, setTemplateTypeFilter] = useState('all');
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<Partial<DocumentTemplate> | null>(null);

  // Generated Documents State
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [documentSearch, setDocumentSearch] = useState('');
  const [documentTypeFilter, setDocumentTypeFilter] = useState('all');
  const [documentStatusFilter, setDocumentStatusFilter] = useState('all');
  const [showDocumentForm, setShowDocumentForm] = useState(false);
  const [currentDocument, setCurrentDocument] = useState<Partial<GeneratedDocument> | null>(null);

  // Employees State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');

  // Statistics State
  const [statistics, setStatistics] = useState<PerformanceStats | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload: DecodedToken = jwtDecode(token);
        setUserRole(payload.user.role);
        setIsHR(payload.user.is_hr || false);
      } catch (error) {
        console.error('Invalid token', error);
        router.push('/');
      }
    } else {
      router.push('/');
    }
  }, [router]);

  useEffect(() => {
    if (userRole && !isHR && userRole !== 'ADMIN') {
      toast.error('HR privileges required to access this page');
      router.push('/dashboard');
    }
  }, [isHR, userRole, router]);

  useEffect(() => {
    if (isHR || userRole === 'ADMIN') {
      fetchData();
    }
  }, [isHR, userRole]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [statsRes, templatesRes, documentsRes, employeesRes] = await Promise.all([
        axios.get('/hr/statistics'),
        axios.get('/hr/templates'),
        axios.get('/hr/documents'),
        axios.get('/auth/organization/employees')
      ]);
      setStatistics(statsRes.data);
      setTemplates(templatesRes.data);
      setDocuments(documentsRes.data);
      setEmployees(employeesRes.data);
    } catch (error) {
      console.error('Failed to fetch HR data', error);
      toast.error('Failed to update dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTemplate = async (templateData: Partial<DocumentTemplate>) => {
    try {
      const response = await axios.post('/hr/templates', templateData);
      setTemplates([...templates, response.data]);
      setShowTemplateForm(false);
      toast.success('Template created successfully');
    } catch (error) {
      toast.error('Failed to create template');
    }
  };

  const handleUpdateTemplate = async (id: string, templateData: Partial<DocumentTemplate>) => {
    try {
      const response = await axios.put(`/hr/templates/${id}`, templateData);
      setTemplates(templates.map(t => t.id === id ? response.data : t));
      setShowTemplateForm(false);
      toast.success('Template updated successfully');
    } catch (error) {
      toast.error('Failed to update template');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await axios.delete(`/hr/templates/${id}`);
      setTemplates(templates.filter(t => t.id !== id));
      toast.success('Template removed');
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const handleGenerateDocument = async (documentData: Partial<GeneratedDocument>) => {
    try {
      const response = await axios.post('/hr/documents', documentData);
      setDocuments([...documents, response.data]);
      setShowDocumentForm(false);
      toast.success('Document generated successfully');
    } catch (error) {
      toast.error('Failed to generate document');
    }
  };

  const handleUpdateDocument = async (id: string, documentData: Partial<GeneratedDocument>) => {
    try {
      const response = await axios.put(`/hr/documents/${id}`, documentData);
      setDocuments(documents.map(d => d.id === id ? response.data : d));
      setShowDocumentForm(false);
      toast.success('Document status updated');
    } catch (error) {
      toast.error('Failed to update document');
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'DRAFT': return { color: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20', icon: Clock, label: 'Draft' };
      case 'GENERATED': return { color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: CheckCircle2, label: 'Generated' };
      case 'SENT': return { color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20', icon: Mail, label: 'Sent' };
      case 'SIGNED': return { color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle2, label: 'Signed' };
      case 'ARCHIVED': return { color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: AlertCircle, label: 'Archived' };
      default: return { color: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20', icon: AlertCircle, label: status };
    }
  };

  const getDocumentTypeInfo = (type: string) => {
    const types: Record<string, { label: string, color: string }> = {
      'OFFER_LETTER': { label: 'Offer Letter', color: 'text-blue-500 bg-blue-500/10' },
      'JOINING_LETTER': { label: 'Joining Letter', color: 'text-emerald-500 bg-emerald-500/10' },
      'PROMOTION_LETTER': { label: 'Promotion', color: 'text-purple-500 bg-purple-500/10' },
      'TERMINATION_LETTER': { label: 'Termination', color: 'text-red-500 bg-red-500/10' },
      'APPRECIATION_LETTER': { label: 'Appreciation', color: 'text-amber-500 bg-amber-500/10' },
      'WARNING_LETTER': { label: 'Warning', color: 'text-orange-500 bg-orange-500/10' },
      'OTHER': { label: 'Other', color: 'text-zinc-500 bg-zinc-500/10' }
    };
    return types[type] || types.OTHER;
  };

  const filteredTemplates = useMemo(() => templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
      template.type.toLowerCase().includes(templateSearch.toLowerCase());
    const matchesType = templateTypeFilter === 'all' || template.type === templateTypeFilter;
    return matchesSearch && matchesType;
  }), [templates, templateSearch, templateTypeFilter]);

  const filteredDocuments = useMemo(() => documents.filter(doc => {
    const name = `${doc.employeeFirstName} ${doc.employeeLastName}`.toLowerCase();
    const matchesSearch = name.includes(documentSearch.toLowerCase()) ||
      doc.type.toLowerCase().includes(documentSearch.toLowerCase());
    const matchesType = documentTypeFilter === 'all' || doc.type === documentTypeFilter;
    const matchesStatus = documentStatusFilter === 'all' || doc.status === documentStatusFilter;
    return matchesSearch && matchesType && matchesStatus;
  }), [documents, documentSearch, documentTypeFilter, documentStatusFilter]);

  const filteredEmployees = useMemo(() => employees.filter(employee => {
    const name = `${employee.firstName} ${employee.lastName}`.toLowerCase();
    return name.includes(employeeSearch.toLowerCase()) ||
      employee.email.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      employee.position.toLowerCase().includes(employeeSearch.toLowerCase());
  }), [employees, employeeSearch]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full animate-pulse"></div>
        </div>
        <p className="text-muted-foreground animate-pulse font-medium">Synchronizing HR Data...</p>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "HR Management", href: "/dashboard/hr" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <Breadcrumbs items={breadcrumbItems} />
          <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
            Human Resources
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Streamline employee documentation, lifecycle management, and organizational compliance from a single command center.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            className="rounded-2xl px-6 py-6 h-auto font-semibold bg-white/5 hover:bg-white/10 border-white/10 text-white transition-all duration-300"
            onClick={() => {
              setCurrentTemplate(null);
              setShowTemplateForm(true);
            }}
          >
            <Layout className="w-5 h-5 mr-2 text-blue-400" />
            New Template
          </Button>
          <Button
            className="rounded-2xl px-6 py-6 h-auto font-semibold bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 transition-all duration-300 shadow-xl shadow-blue-500/20 border-none"
            onClick={() => {
              setCurrentDocument(null);
              setShowDocumentForm(true);
            }}
          >
            <FilePlus className="w-5 h-5 mr-2" />
            Issue Document
          </Button>
        </div>
      </div>

      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Documents Issued', value: statistics.totalDocuments, icon: FileText, color: 'from-blue-500 to-cyan-400' },
            { label: 'Awaiting Action', value: statistics.generatedCount, icon: Clock, color: 'from-indigo-500 to-blue-400' },
            { label: 'Out for Signature', value: statistics.sentCount, icon: Mail, color: 'from-purple-500 to-indigo-400' },
            { label: 'Legally Signed', value: statistics.signedCount, icon: CheckCircle2, color: 'from-emerald-500 to-teal-400' }
          ].map((stat, i) => (
            <Card key={i} className="group relative overflow-hidden bg-card/40 backdrop-blur-sm border-white/5 hover:border-white/10 transition-all duration-500">
              <div className={cn("absolute top-0 right-0 w-32 h-32 opacity-[0.03] -mr-8 -mt-8 rounded-full bg-gradient-to-br transition-all duration-500 group-hover:scale-150", stat.color)}></div>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardDescription className="text-sm font-medium text-muted-foreground uppercase tracking-widest">{stat.label}</CardDescription>
                <stat.icon className="h-5 w-5 text-muted-foreground group-hover:text-white transition-colors duration-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md py-4 -mx-4 px-4">
          <TabsList className="bg-white/5 border border-white/10 p-1.5 rounded-2xl h-auto">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart2 },
              { id: 'templates', label: 'Templates', icon: Layout },
              { id: 'documents', label: 'Vault', icon: FileText },
              { id: 'employees', label: 'Directories', icon: Users },
              { id: 'settings', label: 'Settings', icon: Settings }
            ].map(tab => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="rounded-xl px-6 py-2.5 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white font-medium transition-all duration-300"
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 bg-card/40 border-white/5">
              <CardHeader>
                <CardTitle className="text-xl">Latest Activity</CardTitle>
                <CardDescription>Recent documents and template changes across the organization.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {documents.slice(0, 5).map((doc, i) => {
                    const config = getStatusConfig(doc.status);
                    const type = getDocumentTypeInfo(doc.type);
                    return (
                      <div key={i} className="flex items-center justify-between group p-3 rounded-2xl hover:bg-white/5 transition-colors duration-300">
                        <div className="flex items-center gap-4">
                          <div className={cn("p-2.5 rounded-xl", type.color)}>
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-semibold">{doc.employeeFirstName} {doc.employeeLastName}</p>
                            <p className="text-sm text-muted-foreground">{type.label} • {new Date(doc.generatedAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <Badge className={cn("px-3 py-1 rounded-full border shadow-sm", config.color)}>
                          <config.icon className="w-3.5 h-3.5 mr-1.5" />
                          {config.label}
                        </Badge>
                      </div>
                    );
                  })}
                  {documents.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>No recent activity detected.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-8">
              <Card className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full justify-start rounded-xl h-12 border-white/5 bg-white/5 hover:bg-white/10" onClick={() => setActiveTab('templates')}>
                    <Layout className="w-4 h-4 mr-3 text-indigo-400" />
                    Browse Templates
                  </Button>
                  <Button variant="outline" className="w-full justify-start rounded-xl h-12 border-white/5 bg-white/5 hover:bg-white/10" onClick={() => setActiveTab('employees')}>
                    <Users className="w-4 h-4 mr-3 text-blue-400" />
                    View Directories
                  </Button>
                  <Button variant="outline" className="w-full justify-start rounded-xl h-12 border-white/5 bg-white/5 hover:bg-white/10" onClick={() => window.print()}>
                    <Download className="w-4 h-4 mr-3 text-emerald-400" />
                    Export Analytics
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card/40 border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg">Compliance Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                    <div className="text-center space-y-2">
                      <div className="text-3xl font-bold text-emerald-400">92%</div>
                      <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Doc Verified</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-1/3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                className="pl-10 h-12 rounded-2xl bg-white/5 border-white/10"
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <Select value={templateTypeFilter} onValueChange={setTemplateTypeFilter}>
                <SelectTrigger className="w-[180px] h-12 rounded-2xl bg-white/5 border-white/10">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-white/10">
                  <SelectItem value="all">All Categories</SelectItem>
                  {['OFFER_LETTER', 'JOINING_LETTER', 'PROMOTION_LETTER', 'TERMINATION_LETTER', 'APPRECIATION_LETTER', 'WARNING_LETTER', 'OTHER'].map(t => (
                    <SelectItem key={t} value={t}>{getDocumentTypeLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => {
              const info = getDocumentTypeInfo(template.type);
              return (
                <Card key={template.id} className="group overflow-hidden bg-card/40 border-white/5 hover:border-blue-500/50 transition-all duration-300">
                  <CardHeader className="pb-3 px-6 pt-6">
                    <div className="flex items-start justify-between mb-2">
                      <div className={cn("p-2 rounded-xl", info.color)}>
                        <Layout className="w-5 h-5" />
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white/10" onClick={() => { setCurrentTemplate(template); setShowTemplateForm(true); }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-red-500/10 hover:text-red-400" onClick={() => handleDeleteTemplate(template.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <CardTitle className="text-lg leading-tight">{template.name}</CardTitle>
                    <CardDescription>{getDocumentTypeLabel(template.type)}</CardDescription>
                  </CardHeader>
                  <CardContent className="px-6 pb-6 space-y-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      Revised {new Date(template.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      {template.isDefault ? (
                        <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 rounded-lg">Master Template</Badge>
                      ) : <div />}
                      <Button variant="ghost" className="text-blue-400 p-0 hover:bg-transparent group/btn" onClick={() => { setCurrentTemplate(template); setShowTemplateForm(true); }}>
                        Edit Details
                        <ChevronRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filteredTemplates.length === 0 && (
              <div className="col-span-full py-24 text-center border-2 border-dashed border-white/5 rounded-[2.5rem]">
                <div className="inline-flex p-4 rounded-3xl bg-blue-500/5 text-blue-400 mb-6">
                  <Layout className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold mb-2">No Templates Found</h3>
                <p className="text-muted-foreground mb-8 max-w-sm mx-auto">Create standard document layouts to automate your HR workflows.</p>
                <Button className="rounded-2xl" onClick={() => setShowTemplateForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Build New Template
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6 animate-in slide-in-from-right-4 duration-500">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-1/3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Vault search..."
                className="pl-10 h-12 rounded-2xl bg-white/5 border-white/10"
                value={documentSearch}
                onChange={(e) => setDocumentSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <Select value={documentStatusFilter} onValueChange={setDocumentStatusFilter}>
                <SelectTrigger className="w-[160px] h-12 rounded-2xl bg-white/5 border-white/10">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-white/10">
                  <SelectItem value="all">All Statuses</SelectItem>
                  {['DRAFT', 'GENERATED', 'SENT', 'SIGNED', 'ARCHIVED'].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="bg-card/40 border-white/5 overflow-hidden rounded-[2.5rem]">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 bg-white/5">
                  <TableHead className="py-5 px-6">Recipient</TableHead>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Current Status</TableHead>
                  <TableHead>Issued On</TableHead>
                  <TableHead className="text-right px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => {
                  const config = getStatusConfig(doc.status);
                  const type = getDocumentTypeInfo(doc.type);
                  return (
                    <TableRow key={doc.id} className="border-white/5 hover:bg-white/5 transition-colors group">
                      <TableCell className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-white/10">
                            <AvatarFallback className="text-xs">{(doc.employeeFirstName?.[0] || 'U')}{(doc.employeeLastName?.[0] || 'U')}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{doc.employeeFirstName} {doc.employeeLastName}</p>
                            <p className="text-xs text-muted-foreground">ID: {doc.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("px-2 py-0.5 rounded-lg border-none shadow-none", type.color)}>
                          {type.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", config.color.split(' ')[1])}></div>
                          <span className="text-sm font-medium">{config.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(doc.generatedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white/10" onClick={() => { setCurrentDocument(doc); setShowDocumentForm(true); }}>
                            <Eye className="w-4.5 h-4.5" />
                          </Button>
                          {doc.fileUrl && (
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white/10 text-blue-400" onClick={() => window.open(doc.fileUrl, '_blank')}>
                              <Download className="w-4.5 h-4.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredDocuments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-24 text-center text-muted-foreground italic">
                      No documents found in the vault matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="employees" className="space-y-6 animate-in zoom-in-95 duration-500">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-1/2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Directorate search..."
                className="pl-10 h-12 rounded-2xl bg-white/5 border-white/10"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredEmployees.map((emp) => (
              <Card key={emp.id} className="group relative overflow-hidden bg-card/40 border-white/5 hover:border-blue-500/30 transition-all duration-500">
                <div className="absolute top-0 right-0 w-24 h-24 opacity-0 group-hover:opacity-[0.05] -mr-6 -mt-6 rounded-full bg-blue-500 transition-all duration-700 group-hover:scale-150"></div>
                <CardHeader className="text-center pb-2">
                  <Avatar className="h-20 w-20 mx-auto mb-4 border-2 border-white/10 ring-4 ring-blue-500/5 group-hover:ring-blue-500/20 transition-all duration-500">
                    <AvatarImage src={emp.image} className="object-cover" />
                    <AvatarFallback className="text-xl bg-white/5 font-bold uppercase">{(emp.firstName?.[0] || 'U')}{(emp.lastName?.[0] || 'U')}</AvatarFallback>
                  </Avatar>
                  <CardTitle className="text-lg group-hover:text-blue-400 transition-colors">{emp.firstName} {emp.lastName}</CardTitle>
                  <CardDescription className="font-medium text-xs uppercase tracking-tighter opacity-80">{emp.position}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-muted-foreground gap-2">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="truncate">{emp.email}</span>
                    </div>
                    <div className="flex items-center text-muted-foreground gap-2">
                      <Briefcase className="w-3.5 h-3.5" />
                      <span>{emp.role}</span>
                    </div>
                  </div>
                  <Button
                    className="w-full rounded-xl bg-white/5 hover:bg-blue-600 hover:text-white border-white/5 text-muted-foreground transition-all duration-300"
                    onClick={() => {
                      setCurrentDocument({ employeeId: emp.id, employeeFirstName: emp.firstName, employeeLastName: emp.lastName });
                      setShowDocumentForm(true);
                    }}
                  >
                    <FilePlus className="w-4 h-4 mr-2" />
                    Issue Document
                  </Button>
                </CardContent>
              </Card>
            ))}
            {filteredEmployees.length === 0 && (
              <div className="col-span-full py-24 text-center">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-10" />
                <p className="text-muted-foreground">Specified employee could not be located.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6 animate-in slide-in-from-left-4 duration-500">
          <Card className="bg-card/40 border-white/5 rounded-[2.5rem] overflow-hidden">
            <CardHeader className="p-8 border-b border-white/5 bg-white/2">
              <CardTitle className="text-2xl">Configuration Center</CardTitle>
              <CardDescription>Manage master data and global HR automation settings.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Layout className="w-5 h-5 text-blue-400" />
                    Default Governance
                  </h3>
                  <div className="space-y-3">
                    {['OFFER_LETTER', 'JOINING_LETTER', 'PROMOTION_LETTER', 'TERMINATION_LETTER', 'APPRECIATION_LETTER', 'WARNING_LETTER'].map(type => {
                      const defaultTemplate = templates.find(t => t.type === type && t.isDefault);
                      return (
                        <div key={type} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                          <div>
                            <p className="text-sm font-semibold">{getDocumentTypeLabel(type)}</p>
                            <p className="text-xs text-muted-foreground">{defaultTemplate ? defaultTemplate.name : 'Not Configured'}</p>
                          </div>
                          {defaultTemplate ? (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Active</Badge>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-8 text-blue-400" onClick={() => { setCurrentTemplate({ type } as Partial<DocumentTemplate>); setShowTemplateForm(true); }}>Configure</Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="space-y-6">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    System Rules
                  </h3>
                  <div className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/10 space-y-4">
                    <div className="flex items-center gap-4">
                      <AlertCircle className="w-8 h-8 text-amber-500 opacity-50" />
                      <p className="text-sm text-amber-200/80 leading-relaxed">
                        Automated document issuance triggers are currently controlled by the organization&apos;s global policy settings.
                      </p>
                    </div>
                    <Button className="w-full rounded-xl bg-amber-500 text-amber-950 hover:bg-amber-400 font-bold">Manage Policy</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modern Dialog - Template Form */}
      {showTemplateForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setShowTemplateForm(false)}></div>
          <Card className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden bg-card border-white/10 shadow-2xl rounded-[2.5rem] animate-in zoom-in-95 duration-300 flex flex-col">
            <CardHeader className="p-8 border-b border-white/5 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{currentTemplate?.id ? 'Evolve Blueprint' : 'Architect Template'}</CardTitle>
                <CardDescription>Define the framework for future organizational documents.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setShowTemplateForm(false)}>
                <X className="w-6 h-6" />
              </Button>
            </CardHeader>
            <CardContent className="p-8 overflow-y-auto space-y-8">
              <form id="templateForm" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = {
                  name: formData.get('name') as string,
                  type: formData.get('type') as string,
                  content: formData.get('content') as string,
                  isDefault: formData.get('isDefault') === 'on'
                };
                if (currentTemplate?.id) await handleUpdateTemplate(currentTemplate.id, data);
                else await handleCreateTemplate(data);
              }} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground ml-1">Template Label</label>
                    <Input name="name" defaultValue={currentTemplate?.name} required className="h-14 rounded-2xl bg-white/2 border-white/10 focus:border-blue-500" placeholder="e.g. Standard Employment Offer 2026" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground ml-1">Architecture Category</label>
                    <Select name="type" defaultValue={currentTemplate?.type || 'OFFER_LETTER'} required>
                      <SelectTrigger className="h-14 rounded-2xl bg-white/2 border-white/10 focus:border-blue-500">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {['OFFER_LETTER', 'JOINING_LETTER', 'PROMOTION_LETTER', 'TERMINATION_LETTER', 'APPRECIATION_LETTER', 'WARNING_LETTER', 'OTHER'].map(t => (
                          <SelectItem key={t} value={t}>{getDocumentTypeLabel(t)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground ml-1 flex justify-between">
                    Draft Editor
                    <span className="normal-case text-xs opacity-50">Support Markdown & Placeholders</span>
                  </label>
                  <textarea
                    name="content"
                    defaultValue={currentTemplate?.content || getDefaultTemplateContent(currentTemplate?.type || 'OFFER_LETTER')}
                    className="w-full min-h-[400px] p-6 rounded-[2rem] bg-white/2 border-white/10 focus:border-blue-500 focus:outline-none font-mono text-sm leading-relaxed"
                    required
                  />
                </div>

                <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                  <input type="checkbox" id="isDefault" name="isDefault" defaultChecked={currentTemplate?.isDefault} className="w-5 h-5 rounded-lg accent-blue-500" />
                  <label htmlFor="isDefault" className="text-sm font-semibold">Promote to Organizational Master Blueprint</label>
                </div>
              </form>
            </CardContent>
            <div className="p-8 border-t border-white/5 bg-white/2 flex justify-end gap-3">
              <Button variant="ghost" className="rounded-xl h-12 px-6" onClick={() => setShowTemplateForm(false)}>Discard</Button>
              <Button form="templateForm" type="submit" className="rounded-xl h-12 px-8 bg-blue-600 hover:bg-blue-500">Commit Changes</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modern Dialog - Document Issuance */}
      {showDocumentForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setShowDocumentForm(false)}></div>
          <Card className="relative w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden bg-card border-white/10 shadow-2xl rounded-[2.5rem] animate-in zoom-in-95 duration-300">
            <CardHeader className="p-8 border-b border-white/5 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{currentDocument?.id ? 'Record History' : 'Document Issuance'}</CardTitle>
                <CardDescription>Legally bind organizational events with official records.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setShowDocumentForm(false)}>
                <X className="w-6 h-6" />
              </Button>
            </CardHeader>
            <CardContent className="p-8 overflow-y-auto space-y-8">
              <form id="docForm" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = {
                  templateId: formData.get('templateId') as string,
                  employeeId: formData.get('employeeId') as string,
                  content: formData.get('content') as string,
                  status: formData.get('status') as string,
                  notes: formData.get('notes') as string
                };
                if (currentDocument?.id) await handleUpdateDocument(currentDocument.id, data);
                else await handleGenerateDocument(data);
              }} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground ml-1">Recipient</label>
                    <Select name="employeeId" defaultValue={currentDocument?.employeeId} required disabled={!!currentDocument?.id}>
                      <SelectTrigger className="h-14 rounded-2xl bg-white/2 border-white/10 focus:border-blue-500">
                        <SelectValue placeholder="Select Recipient" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground ml-1">Blueprint</label>
                    <Select name="templateId" defaultValue={currentDocument?.templateId} required>
                      <SelectTrigger className="h-14 rounded-2xl bg-white/2 border-white/10 focus:border-blue-500">
                        <SelectValue placeholder="Select Blueprint" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {templates.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground ml-1">Finalized Content</label>
                  <textarea
                    name="content"
                    defaultValue={currentDocument?.content || ''}
                    className="w-full min-h-[300px] p-6 rounded-[2rem] bg-white/2 border-white/10 focus:border-blue-500 focus:outline-none font-mono text-sm leading-relaxed"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground ml-1">Operational State</label>
                    <Select name="status" defaultValue={currentDocument?.status || 'GENERATED'}>
                      <SelectTrigger className="h-14 rounded-2xl bg-white/2 border-white/10 focus:border-blue-500">
                        <SelectValue placeholder="Select State" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {['DRAFT', 'GENERATED', 'SENT', 'SIGNED', 'ARCHIVED'].map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground ml-1">Registry Notes</label>
                    <Input name="notes" defaultValue={currentDocument?.notes} className="h-14 rounded-2xl bg-white/2 border-white/10 focus:border-blue-500" placeholder="Optional audit notes" />
                  </div>
                </div>
              </form>
            </CardContent>
            <div className="p-8 border-t border-white/5 bg-white/2 flex justify-end gap-3">
              <Button variant="ghost" className="rounded-xl h-12 px-6" onClick={() => setShowDocumentForm(false)}>Cancel</Button>
              <Button form="docForm" type="submit" className="rounded-xl h-12 px-8 bg-indigo-600 hover:bg-indigo-500 transition-all duration-300 shadow-lg shadow-indigo-600/20">Sign & Vault</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function getDocumentTypeLabel(type: string) {
  const types: Record<string, string> = {
    'OFFER_LETTER': 'Offer Blueprint',
    'JOINING_LETTER': 'Onboarding Charter',
    'PROMOTION_LETTER': 'Career Progression',
    'TERMINATION_LETTER': 'Exit Notice',
    'APPRECIATION_LETTER': 'Appreciation Award',
    'WARNING_LETTER': 'Conduct Notice',
    'OTHER': 'Custom Registry'
  };
  return types[type] || type;
}

function getDefaultTemplateContent(type: string): string {
  const templates: Record<string, string> = {
    OFFER_LETTER: `# EMPLOYMENT OFFER CHARTER\n\n**Date:** [Date]\n\n**Recipient:** [Employee Name]\n**Position:** [Position]\n\nDear [Employee Name],\n\nWe are formally extending an architect role at **Antigravity Systems**. We believe your specialized skills will be a significant catalyst for our mission.\n\n### TERMS OF ENGAGEMENT\n- **Base Compensation:** [Salary]\n- **Engagement Date:** [Start Date]\n- **Primary Directive:** [Mission/Role Summary]\n\nWe look forward to your integration into our collective.\n\n**Regards,**\n\nExecutive Directorate\n*Antigravity Systems*`,
    JOINING_LETTER: `# ONBOARDING CONFIRMATION\n\n**Integration Date:** [Joining Date]\n**Personnel:** [Employee Name]\n\nWelcome to the operational team. Your credentials have been verified and access is being provisioned.\n\n### PROTOCOLS\n1. Review the Core Directives.\n2. Complete the Security Integration.\n3. Report to Phase 1 Directorate.\n\n**Signed,**\n\nHR Operations Directorate`,
    PROMOTION_LETTER: `# CAREER PROGRESSION CERTIFICATE\n\n**New Designation:** [New Position]\n**Effective Temporal Point:** [Effective Date]\n\nCongratulations, [Employee Name]. This progression recognizes your sustained excellence and adherence to operational standards.\n\nYour compensation and authority levels have been adjusted accordingly in the central registry.\n\n**Antigravity Systems**`,
    TERMINATION_LETTER: `# EXIT COMMUNICATON\n\n**Effective Point:** [Termination Date]\n**Recipient:** [Employee Name]\n\nNotice of disengagement from **Antigravity Systems**. Please initiate terminal protocols with HR.\n\nAll organizational assets must be returned to the primary hub by the effective point.\n\n**Personnel Directorate**`,
    APPRECIATION_LETTER: `# MERIT RECOGNITION\n\n**Recipient:** [Employee Name]\n\nRecognizing exceptional contributions towards organizational objectives. Your performance has exceeded established parameters.\n\nKeep ascending.\n\n**Executive Council**`,
    WARNING_LETTER: `# CONDUCT NOTICE\n\n**Recipient:** [Employee Name]\n**Subject:** Performance Deviation\n\nFormally documenting a deviation from established operational standards. Immediate recalibration is required.\n\n### REQUIRED ACTIONS\n- Immediate improvement in [Target Area]\n- Review protocol [Protocol Name]\n\n**Registry Office**`,
    OTHER: `# CUSTOM RECORD\n\n**Personnel:** [Employee Name]\n\n[Record Detail Content]\n\n**Registry Hub**`
  };
  return templates[type] || templates.OTHER;
}