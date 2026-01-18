import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  GripVertical, 
  ArrowLeft,
  Loader2,
  Lock,
  FileText,
  MessageSquare,
  Save
} from "lucide-react";
import type { Question, SiteContent } from "@shared/schema";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const categoryLabels: Record<string, string> = {
  vision: "Vision & Aspirations",
  design: "Design Preferences",
  functional: "Functional Requirements",
  lifestyle: "Lifestyle & Entertainment",
  emotional: "Personal & Emotional"
};

const categoryColors: Record<string, string> = {
  vision: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  design: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  functional: "bg-green-500/10 text-green-500 border-green-500/20",
  lifestyle: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  emotional: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

type QuestionFormData = {
  title: string;
  question: string;
  helpText: string;
  category: string;
  isActive: boolean;
};

type SortableQuestionCardProps = {
  question: Question;
  onEdit: (question: Question) => void;
  onDelete: (id: number) => void;
};

function SiteContentTab({ adminToken }: { adminToken: string }) {
  const { toast } = useToast();
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const { data: content = [], isLoading } = useQuery<SiteContent[]>({
    queryKey: ["/api/admin/content"],
    queryFn: async () => {
      const response = await fetch("/api/admin/content", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!response.ok) throw new Error("Failed to fetch content");
      return response.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      setSaving(prev => ({ ...prev, [key]: true }));
      const response = await fetch(`/api/admin/content/${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ value }),
      });
      if (!response.ok) throw new Error("Failed to update content");
      return response.json();
    },
    onSuccess: (_, { key }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      setEditedContent(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setSaving(prev => ({ ...prev, [key]: false }));
      toast({ title: "Content updated" });
    },
    onError: (_, { key }) => {
      setSaving(prev => ({ ...prev, [key]: false }));
      toast({ title: "Error", description: "Failed to update content", variant: "destructive" });
    },
  });

  const groupedContent = content.reduce((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = [];
    }
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, SiteContent[]>);

  const handleChange = (key: string, value: string) => {
    setEditedContent(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = (item: SiteContent) => {
    const newValue = editedContent[item.key];
    if (newValue !== undefined && newValue !== item.value) {
      updateMutation.mutate({ key: item.key, value: newValue });
    }
  };

  const hasChanges = (key: string, originalValue: string) => {
    return editedContent[key] !== undefined && editedContent[key] !== originalValue;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {Object.entries(groupedContent).map(([section, items]) => (
        <Card key={section}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {section}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item) => (
              <div key={item.key} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={item.key}>{item.label}</Label>
                  {hasChanges(item.key, item.value) && (
                    <Button
                      size="sm"
                      onClick={() => handleSave(item)}
                      disabled={saving[item.key]}
                      data-testid={`button-save-${item.key}`}
                    >
                      {saving[item.key] ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Save className="w-3 h-3" />
                      )}
                      <span className="ml-1">Save</span>
                    </Button>
                  )}
                </div>
                {item.value.length > 80 ? (
                  <Textarea
                    id={item.key}
                    value={editedContent[item.key] ?? item.value}
                    onChange={(e) => handleChange(item.key, e.target.value)}
                    rows={3}
                    data-testid={`input-content-${item.key}`}
                  />
                ) : (
                  <Input
                    id={item.key}
                    value={editedContent[item.key] ?? item.value}
                    onChange={(e) => handleChange(item.key, e.target.value)}
                    data-testid={`input-content-${item.key}`}
                  />
                )}
                <p className="text-xs text-muted-foreground">{item.key}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SortableQuestionCard({ question, onEdit, onDelete }: SortableQuestionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <Card 
      ref={setNodeRef}
      style={style as React.CSSProperties}
      className={`transition-opacity ${!question.isActive ? "opacity-60" : ""}`}
      data-testid={`card-question-${question.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div 
            className="flex-shrink-0 pt-1 text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
            {...attributes}
            {...listeners}
            data-testid={`drag-handle-${question.id}`}
          >
            <GripVertical className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge 
                variant="outline" 
                className={categoryColors[question.category]}
              >
                {categoryLabels[question.category]}
              </Badge>
              {!question.isActive && (
                <Badge variant="secondary">Inactive</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                #{question.sortOrder}
              </span>
            </div>
            <h3 className="font-medium mb-1" data-testid={`text-question-title-${question.id}`}>
              {question.title}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {question.question}
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => onEdit(question)}
              data-testid={`button-edit-${question.id}`}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => {
                if (confirm("Are you sure you want to delete this question?")) {
                  onDelete(question.id);
                }
              }}
              data-testid={`button-delete-${question.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeTab, setActiveTab] = useState("questions");
  
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState<QuestionFormData>({
    title: "",
    question: "",
    helpText: "",
    category: "vision",
    isActive: true,
  });
  
  useEffect(() => {
    const stored = sessionStorage.getItem("adminToken");
    if (stored) {
      setAdminToken(stored);
    }
  }, []);

  const verifyToken = async () => {
    setIsVerifying(true);
    try {
      const response = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput }),
      });
      
      if (response.ok) {
        setAdminToken(tokenInput);
        sessionStorage.setItem("adminToken", tokenInput);
        toast({ title: "Access granted", description: "Welcome to the admin panel." });
      } else {
        toast({ 
          title: "Access denied", 
          description: "Invalid admin token.", 
          variant: "destructive" 
        });
      }
    } catch {
      toast({ 
        title: "Error", 
        description: "Failed to verify token.", 
        variant: "destructive" 
      });
    }
    setIsVerifying(false);
  };

  const { data: questions = [], isLoading } = useQuery<Question[]>({
    queryKey: ["/api/admin/questions"],
    enabled: !!adminToken,
    queryFn: async () => {
      const response = await fetch("/api/admin/questions", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!response.ok) throw new Error("Failed to fetch questions");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: QuestionFormData) => {
      const response = await fetch("/api/admin/questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create question");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/questions"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "Question created" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create question", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<QuestionFormData> }) => {
      const response = await fetch(`/api/admin/questions/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update question");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/questions"] });
      setEditingQuestion(null);
      resetForm();
      toast({ title: "Question updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update question", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/questions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!response.ok) throw new Error("Failed to delete question");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/questions"] });
      toast({ title: "Question deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete question", variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: number[]) => {
      const response = await fetch("/api/admin/questions/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ orderedIds }),
      });
      if (!response.ok) throw new Error("Failed to reorder questions");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/questions"] });
      toast({ title: "Questions reordered" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reorder questions", variant: "destructive" });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const activeId = Number(active.id);
      const overId = Number(over.id);
      const oldIndex = questions.findIndex((q) => q.id === activeId);
      const newIndex = questions.findIndex((q) => q.id === overId);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(questions, oldIndex, newIndex);
        const orderedIds = reordered.map((q) => q.id);
        reorderMutation.mutate(orderedIds);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      question: "",
      helpText: "",
      category: "vision",
      isActive: true,
    });
  };

  const openEditDialog = (question: Question) => {
    setEditingQuestion(question);
    setFormData({
      title: question.title,
      question: question.question,
      helpText: question.helpText || "",
      category: question.category,
      isActive: question.isActive,
    });
  };

  const isFormValid = formData.title.trim().length > 0 && formData.question.trim().length > 0;

  const handleSave = () => {
    if (!isFormValid) {
      toast({ 
        title: "Validation Error", 
        description: "Title and question are required.", 
        variant: "destructive" 
      });
      return;
    }
    
    const cleanedData = {
      ...formData,
      title: formData.title.trim(),
      question: formData.question.trim(),
      helpText: formData.helpText.trim() || undefined,
    };
    
    if (editingQuestion) {
      updateMutation.mutate({ id: editingQuestion.id, data: cleanedData });
    } else {
      createMutation.mutate(cleanedData as QuestionFormData);
    }
  };

  if (!adminToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Admin Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Admin Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="Enter admin token"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verifyToken()}
                data-testid="input-admin-token"
              />
            </div>
            <Button 
              onClick={verifyToken} 
              disabled={isVerifying || !tokenInput}
              className="w-full"
              data-testid="button-verify-token"
            >
              {isVerifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Access Admin Panel
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => navigate("/")}
              className="w-full"
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Admin Panel</h1>
          </div>
          {activeTab === "questions" && (
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-question">
              <Plus className="w-4 h-4 mr-2" />
              Add Question
            </Button>
          )}
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="questions" className="gap-2" data-testid="tab-questions">
              <MessageSquare className="w-4 h-4" />
              Questions
            </TabsTrigger>
            <TabsTrigger value="content" className="gap-2" data-testid="tab-content">
              <FileText className="w-4 h-4" />
              Site Content
            </TabsTrigger>
          </TabsList>

          <TabsContent value="questions">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {questions.filter(q => q.isActive).length === 0 && questions.length > 0 && (
                  <Card className="border-amber-500/50 bg-amber-500/5">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-amber-600 font-bold text-sm">!</span>
                      </div>
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        Warning: No active questions. Clients won't be able to complete briefings.
                      </p>
                    </CardContent>
                  </Card>
                )}
                
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={questions.map(q => q.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {questions.map((question) => (
                      <SortableQuestionCard
                        key={question.id}
                        question={question}
                        onEdit={openEditDialog}
                        onDelete={(id) => deleteMutation.mutate(id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>

                {questions.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No questions yet. Click "Add Question" to create one.</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="content">
            <SiteContentTab adminToken={adminToken} />
          </TabsContent>
        </Tabs>
      </main>

      <Dialog 
        open={isCreateDialogOpen || !!editingQuestion} 
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingQuestion(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? "Edit Question" : "Add New Question"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g., Your Vision"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                data-testid="input-question-title"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="question">Question</Label>
              <Textarea
                id="question"
                placeholder="Enter the full question text..."
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                rows={3}
                data-testid="input-question-text"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="helpText">Help Text (optional)</Label>
              <Textarea
                id="helpText"
                placeholder="Additional guidance for the client..."
                value={formData.helpText}
                onChange={(e) => setFormData({ ...formData, helpText: e.target.value })}
                rows={2}
                data-testid="input-question-help"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="category" data-testid="select-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vision">Vision & Aspirations</SelectItem>
                  <SelectItem value="design">Design Preferences</SelectItem>
                  <SelectItem value="functional">Functional Requirements</SelectItem>
                  <SelectItem value="lifestyle">Lifestyle & Entertainment</SelectItem>
                  <SelectItem value="emotional">Personal & Emotional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Active</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-active"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setEditingQuestion(null);
                resetForm();
              }}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.title || !formData.question || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-question"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingQuestion ? "Save Changes" : "Create Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
