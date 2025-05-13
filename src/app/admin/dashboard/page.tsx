"use client";

import { useState, useEffect, useCallback } from "react";
import { PlusCircle, Edit, Trash2, Loader2, BarChartBig, Users, FileText, Zap, Activity, CalendarClock, Eye } from "lucide-react";
import { formatInTimeZone } from 'date-fns-tz';
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import ArticleForm, { type ArticleFormData } from "@/components/admin/ArticleForm";
import type { NewsArticle, CreateNewsArticleData, DashboardAnalytics } from "@/lib/types";
import {
  getAllNewsArticles,
  addNewsArticle,
  updateNewsArticle,
  deleteNewsArticle,
  getDashboardAnalytics,
  getTopUserPostActivity
} from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import AnalyticsCard from "@/components/admin/AnalyticsCard"; 

const DHAKA_TIMEZONE = 'Asia/Dhaka';

export default function DashboardPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [topUsersActivity, setTopUsersActivity] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<NewsArticle | null>(null);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<NewsArticle | null>(null);

  const { toast } = useToast();

  const fetchDashboardData = useCallback(async () => {
    setIsAnalyticsLoading(true);
    try {
      const [analyticsData, topUsersData] = await Promise.all([
        getDashboardAnalytics(),
        getTopUserPostActivity(5) 
      ]);
      setAnalytics(analyticsData ?? { totalArticles: 0, articlesToday: 0, totalUsers: 0, activeGadgets: 0, visitorStats: { today: 0, thisWeek: 0, thisMonth: 0, lastMonth: 0, activeNow: 0 }, userPostActivity: [] });
      setTopUsersActivity(topUsersData ?? []);
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch dashboard analytics.", variant: "destructive" });
      setAnalytics({ totalArticles: 0, articlesToday: 0, totalUsers: 0, activeGadgets: 0, visitorStats: { today: 0, thisWeek: 0, thisMonth: 0, lastMonth: 0, activeNow: 0 }, userPostActivity: [] });
      setTopUsersActivity([]);
    } finally {
      setIsAnalyticsLoading(false);
    }
  }, [toast]);

  const fetchArticles = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedArticles = await getAllNewsArticles();
      const safeArticles = Array.isArray(fetchedArticles) ? fetchedArticles : [];
      setArticles(safeArticles.sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime()));
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch articles.", variant: "destructive" });
      setArticles([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDashboardData();
    fetchArticles();
  }, [fetchDashboardData, fetchArticles]);

  const handleAddArticle = () => {
    setEditingArticle(null);
    setIsAddEditDialogOpen(true);
  };

  const handleEditArticle = (article: NewsArticle) => {
    setEditingArticle(article);
    setIsAddEditDialogOpen(true);
  };

  const handleDeleteArticle = (article: NewsArticle) => {
    setArticleToDelete(article);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteArticle = async () => {
    if (!articleToDelete) return;
    setIsSubmitting(true);
    try {
      const success = await deleteNewsArticle(articleToDelete.id);
      if (success) {
        await fetchArticles(); 
        await fetchDashboardData(); 
        toast({ title: "Success", description: "Article deleted successfully." });
      } else {
        toast({ title: "Error", description: "Failed to delete article.", variant: "destructive" });
      }
    } catch (error) {
       const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
       console.error("Error deleting article:", error);
       toast({ title: "Error", description: An error occurred while deleting the article: ${errorMessage}, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setIsDeleteDialogOpen(false);
      setArticleToDelete(null);
    }
  };

  const handleFormSubmit = async (data: ArticleFormData) => {
    setIsSubmitting(true);
    try {
      if (editingArticle) {
         const updateData: Partial<Omit<NewsArticle, 'id' | 'publishedDate'>> = {
            title: data.title,
            content: data.content,
            excerpt: data.excerpt,
            category: data.category,
            imageUrl: data.imageUrl,
            dataAiHint: data.dataAiHint,
            inlineAdSnippets: data.inlineAdSnippetsInput?.split('\n\n').map(s => s.trim()).filter(s => s !== '') || [],
            metaTitle: data.metaTitle,
            metaDescription: data.metaDescription,
            metaKeywords: data.metaKeywords?.split(',').map(k => k.trim()).filter(k => k),
            ogTitle: data.ogTitle,
            ogDescription: data.ogDescription,
            ogImage: data.ogImage,
            canonicalUrl: data.canonicalUrl,
            articleYoutubeUrl: data.articleYoutubeUrl,
            articleFacebookUrl: data.articleFacebookUrl,
            articleMoreLinksUrl: data.articleMoreLinksUrl,
         };
        const result = await updateNewsArticle(editingArticle.id, updateData);
        if (result) {
          toast({ title: "Success", description: "Article updated successfully." });
        } else {
           toast({ title: "Error", description: "Failed to update article.", variant: "destructive" });
        }
      } else {
         const createData: CreateNewsArticleData = {
            title: data.title,
            content: data.content,
            excerpt: data.excerpt,
            category: data.category,
            imageUrl: data.imageUrl,
            dataAiHint: data.dataAiHint,
            inlineAdSnippets: data.inlineAdSnippetsInput?.split('\n\n').map(s => s.trim()).filter(s => s !== '') || [],
            metaTitle: data.metaTitle,
            metaDescription: data.metaDescription,
            metaKeywords: data.metaKeywords?.split(',').map(k => k.trim()).filter(k => k),
            ogTitle: data.ogTitle,
            ogDescription: data.ogDescription,
            ogImage: data.ogImage,
            canonicalUrl: data.canonicalUrl,
            articleYoutubeUrl: data.articleYoutubeUrl,
            articleFacebookUrl: data.articleFacebookUrl,
            articleMoreLinksUrl: data.articleMoreLinksUrl,
         };
        const result = await addNewsArticle(createData);
         if (result) {
            toast({ title: "Success", description: "Article added successfully." });
        } else {
            toast({ title: "Error", description: "Failed to add article.", variant: "destructive" });
        }
      }
      await fetchArticles(); 
      await fetchDashboardData(); 
      setIsAddEditDialogOpen(false);
      setEditingArticle(null);
    } catch (error) {
       const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
       console.error("Error saving article:", error);
       toast({ title: "Error", description: An error occurred while saving the article: ${errorMessage}, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const errorExplanation = (
     <Card className="mb-6 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30">
        <CardHeader>
            <CardTitle className="text-lg text-yellow-800 dark:text-yellow-300">Note on Console Errors &amp; Page Display</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-yellow-700 dark:text-yellow-200 space-y-2">
            <p>
                If you see errors in your browser's developer console related to <code>extensions.aitopia.ai</code> or similar domains not controlled by this application, these are likely caused by a browser extension you have installed (e.g., Aitopia). These errors are not part of Samay Barta Lite and can usually be ignored or resolved by managing your browser extensions.
            </p>
            <p>
                If this Dashboard page, or other admin pages, appear blank or don't load correctly (showing "An error occurred in the Server Components render" on a white screen), and there are no other specific errors in the console directly related to the application's files (e.g., <code>dashboard/page.tsx</code>, <code>lib/data.ts</code>, <code>lib/mongodb.ts</code>), the issue might be due to:
            </p>
            <ul className="list-disc pl-5 space-y-1">
                <li><strong>Environment Variables:</strong> Crucial environment variables (like <code>MONGODB_URI</code> or <code>GEMINI_API_KEY</code>) might be missing or incorrect in your Vercel project settings (or your local <code>.env</code> file). Ensure they are correctly set and that the <code>MONGODB_URI</code> does not contain any placeholder values like <code>&lt;username&gt;</code> or <code>&lt;cluster-url&gt;</code>.</li>
                <li><strong>Database Connectivity:</strong> There could be an issue connecting to your MongoDB database (e.g., incorrect credentials in the URI, IP allowlist on MongoDB Atlas not configured for Vercel, or network issues).</li>
                <li><strong>API Key Issues:</strong> The <code>GEMINI_API_KEY</code> might be invalid or have exceeded its quota.</li>
                <li><strong>Server-Side Errors:</strong> An unhandled error might be occurring in one of the server actions called by this page. Check Vercel deployment logs for more specific error messages from the server.</li>
            </ul>
             <p>
                Ensure all environment variables are correctly configured in your Vercel project dashboard for the deployed version to function correctly.
            </p>
        </CardContent>
     </Card>
  );

  if (isLoading || isAnalyticsLoading) {
    return (
      <div className="container mx-auto py-8">
        {errorExplanation}
        <div className="flex items-center justify-center min-h-[calc(100vh-20rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {errorExplanation}
      <Card className="shadow-lg rounded-xl mb-8">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary flex items-center gap-2">
            <BarChartBig /> Site Overview
          </CardTitle>
          <CardDescription>A quick look at your site's key metrics.</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <AnalyticsCard title="Total Articles" value={analytics.totalArticles.toString()} icon={FileText} />
              <AnalyticsCard title="Articles Today" value={analytics.articlesToday.toString()} icon={CalendarClock} />
              <AnalyticsCard title="Total Users" value={analytics.totalUsers.toString()} icon={Users} />
              <AnalyticsCard title="Active Gadgets" value={analytics.activeGadgets.toString()} icon={Zap} />
              
              <AnalyticsCard title="Visitors Today" value={analytics.visitorStats?.today?.toString() ?? "N/A"} icon={Eye} description="Requires tracking setup" />
              <AnalyticsCard title="Active Visitors Now" value={analytics.visitorStats?.activeNow?.toString() ?? "N/A"} icon={Activity} description="Requires tracking setup" />
              <AnalyticsCard title="Visitors This Week" value={analytics.visitorStats?.thisWeek?.toString() ?? "N/A"} icon={Eye} description="Requires tracking setup" />
              <AnalyticsCard title="Visitors This Month" value={analytics.visitorStats?.thisMonth?.toString() ?? "N/A"} icon={Eye} description="Requires tracking setup" />

            </div>
          ) : (
             <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          )}
        </CardContent>
      </Card>
      
      {topUsersActivity.length > 0 && (
        <Card className="shadow-lg rounded-xl mb-8">
            <CardHeader>
                <CardTitle className="text-xl font-bold text-primary flex items-center gap-2">
                    <Users /> Top User Activity
                </CardTitle>
                <CardDescription>Most active users by post count (requires authorId tracking on articles).</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Username</TableHead>
                            <TableHead>Posts Today</TableHead>
                            <TableHead>Posts This Week</TableHead>
                            <TableHead>Posts This Month</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {topUsersActivity.map(user => (
                            <TableRow key={user.userId}>
                                <TableCell>{user.username}</TableCell>
                                <TableCell>{user.postsToday}</TableCell>
                                <TableCell>{user.postsThisWeek}</TableCell>
                                <TableCell>{user.postsThisMonth}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                 <p className="text-xs text-muted-foreground mt-2">Note: User post activity relies on articles being associated with authors (authorId).</p>
            </CardContent>
        </Card>
      )}

      <Card className="shadow-lg rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold text-primary">Manage News Articles</CardTitle>
            <CardDescription>Add, edit, or delete news articles.</CardDescription>
          </div>
          <Button onClick={handleAddArticle} size="sm" className="ml-auto gap-1">
            <PlusCircle className="h-4 w-4" />
            Add New Article
          </Button>
        </CardHeader>
        <CardContent>
          {articles.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No articles found. Add one to get started!</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Published Date</TableHead>
                  <TableHead className="text-right w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.map((article) => (
                  <TableRow key={article.id}>
                    <TableCell className="font-medium">{article.title}</TableCell>
                    <TableCell>{article.category}</TableCell>
                    <TableCell>{formatInTimeZone(new Date(article.publishedDate), DHAKA_TIMEZONE, "MMM d, yyyy, h:mm a zzz")}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEditArticle(article)} className="mr-2 hover:text-primary">
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteArticle(article)} className="hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                         <span className="sr-only">Delete</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddEditDialogOpen} onOpenChange={(isOpen) => {
          if (!isOpen) {
              setIsAddEditDialogOpen(false);
              setEditingArticle(null);
          } else {
              setIsAddEditDialogOpen(true);
          }
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingArticle ? "Edit Article" : "Add New Article"}</DialogTitle>
            <DialogDescription>
              {editingArticle ? "Modify the details of the existing article." : "Fill in the details to create a new news article."}
            </DialogDescription>
          </DialogHeader>
          {isAddEditDialogOpen && (
            <ArticleForm
              article={editingArticle}
              onSubmit={handleFormSubmit}
              onCancel={() => {
                  setIsAddEditDialogOpen(false);
                  setEditingArticle(null);
              }}
              isSubmitting={isSubmitting}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={(isOpen) => {
          if (!isOpen) {
              setIsDeleteDialogOpen(false);
              setArticleToDelete(null);
          } else {
               setIsDeleteDialogOpen(true);
          }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the article &amp;quot;{articleToDelete?.title}&amp;quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => {
                setIsDeleteDialogOpen(false);
                setArticleToDelete(null);
            }} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDeleteArticle} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )};
